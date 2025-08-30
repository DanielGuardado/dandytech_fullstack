"""Tiny migration runner for SQL Server using SQLAlchemy.
- Applies SQL files in db/migrations/ in filename order
- Records each applied file in dbo.SchemaMigrations
- Optionally (re)creates procs in db/procs/ and runs idempotent seeds in db/seeds/

Requires env var DATABASE_URL, e.g.:
  mssql+pyodbc:///?odbc_connect=DRIVER%3DODBC+Driver+17+for+SQL+Server%3BSERVER%3Dlocalhost%3BDATABASE%3Dresale%3BTrusted_Connection%3Dyes%3BTrustServerCertificate%3Dyes%3B
"""
import os, sys, time, hashlib
from pathlib import Path
from sqlalchemy import create_engine

# 🔑 Auto-load .env file from project root
from dotenv import load_dotenv

# Always resolve base relative to migrate.py → up two dirs (project root)
BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


def split_batches(sql: str):
    batches = []
    current = []
    for line in sql.splitlines():
        token = line.strip()
        upper = token.upper()
        if upper == "GO" or upper == "GO;" or upper.startswith("GO "):
            if current:
                batches.append("\n".join(current))
                current = []
        else:
            current.append(line)
    if current:
        batches.append("\n".join(current))
    return batches


def apply_sql(conn, sql_text: str):
    for batch in split_batches(sql_text):
        if batch.strip():
            conn.exec_driver_sql(batch)


def get_applied_versions(conn):
    try:
        rows = conn.exec_driver_sql("SELECT version FROM dbo.SchemaMigrations").fetchall()
        return {r[0] for r in rows}
    except Exception:
        return set()


def record_migration(conn, version: str, name: str, checksum: bytes, duration_ms: int):
    conn.exec_driver_sql(
        "INSERT INTO dbo.SchemaMigrations(version, name, checksum, duration_ms, executed_by) VALUES (?, ?, ?, ?, SUSER_SNAME());",
        (version, name, checksum, duration_ms),
    )


def infer_version_and_name(path: Path):
    base = path.stem
    version = base
    name = base
    if "_" in base:
        name = base.split("_", 1)[1].replace("_", " ").replace("-", " ")
    return version, name


def run(db_url: str | None = None, run_seeds: bool = True, run_procs: bool = True, base_dir: str | None = None):
    db_url = db_url or os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL env var is required.", file=sys.stderr)
        sys.exit(1)

    base = Path(base_dir or Path(__file__).resolve().parents[1])
    mig_dir = base / "db" / "migrations"
    seed_dir = base / "db" / "seeds"
    proc_dir = base / "db" / "procs"

    mig_files = sorted(mig_dir.glob("*.sql"))
    seed_files = sorted(seed_dir.glob("*.sql")) if seed_dir.exists() else []
    proc_files = sorted(proc_dir.glob("*.sql")) if proc_dir.exists() else []

    engine = create_engine(db_url, future=True)

    # --- 1) Open a dedicated AUTOCOMMIT connection for locking / reads ---
    with engine.connect() as ctl:
        ctl = ctl.execution_options(isolation_level="AUTOCOMMIT")

        # Acquire lock
        res = ctl.exec_driver_sql(
            """
            DECLARE @r INT;
            EXEC @r = sp_getapplock
                @Resource     = 'resale_schema_migrations',
                @LockMode     = 'Exclusive',
                @LockOwner    = 'Session',
                @LockTimeout  = 30000;
            SELECT @r;
            """
        ).fetchone()
        if res and int(res[0]) < 0:
            raise RuntimeError("Could not acquire migration lock")

        # Read applied versions (still on ctl, no txn)
        applied = get_applied_versions(ctl)

        try:
            # --- 2) Open a separate connection for transactional work ---
            with engine.connect() as conn_tx:

                # Migrations
                for p in mig_files:
                    content = p.read_text(encoding="utf-8")
                    version, name = infer_version_and_name(p)
                    if version in applied:
                        print(f"= skip {version} ({p.name})")
                        continue

                    print(f"→ applying {version} ({p.name}) …")
                    t0 = time.perf_counter()

                    with conn_tx.begin():
                        apply_sql(conn_tx, content)
                        checksum = hashlib.sha256(content.encode("utf-8")).digest()
                        duration_ms = int((time.perf_counter() - t0) * 1000)
                        record_migration(conn_tx, version, name, checksum, duration_ms)

                    print(f"✓ applied {version} in {duration_ms} ms")

                # Procs
                if run_procs and proc_files:
                    print("→ (re)creating stored procs …")
                    with conn_tx.begin():
                        for p in proc_files:
                            print(f"   - {p.name}")
                            apply_sql(conn_tx, p.read_text(encoding="utf-8"))

                # Seeds
                if run_seeds and seed_files:
                    print("→ running seeds …")
                    with conn_tx.begin():
                        for p in seed_files:
                            print(f"   - {p.name}")
                            apply_sql(conn_tx, p.read_text(encoding="utf-8"))

        finally:
            # Release lock from the ctl connection
            ctl.exec_driver_sql(
                "EXEC sp_releaseapplock @Resource='resale_schema_migrations', @LockOwner='Session';"
            )

    print("All done.")


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="Apply SQL migrations/seeds for Resale app")
    ap.add_argument("--no-seeds", action="store_true", help="Do not run seeds")
    ap.add_argument("--no-procs", action="store_true", help="Do not (re)create stored procs")
    ap.add_argument("--db-url", help="Override DATABASE_URL")
    ap.add_argument("--base-dir", help="Override project base directory")
    args = ap.parse_args()
    run(db_url=args.db_url, run_seeds=not args.no_seeds, run_procs=not args.no_procs, base_dir=args.base_dir)

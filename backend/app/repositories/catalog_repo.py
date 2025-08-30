from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.errors import AppError
import json

class CatalogRepo:
    def __init__(self, db: Session):
        self.db = db

    # ---------- Helpers / lookups

    def get_category_name(self, category_id: int) -> str:
        row = self.db.execute(
            text("SELECT name FROM dbo.Categories WHERE category_id=:cid AND is_active=1"),
            {"cid": category_id},
        ).fetchone()
        if not row:
            raise AppError(f"Invalid category_id={category_id}", 400)
        return row[0]

    def platform_by_id(self, platform_id: int) -> Optional[Dict]:
        row = self.db.execute(
            text("""
                SELECT platform_id, name, short_name, category_id
                FROM dbo.Platforms WHERE platform_id=:pid AND is_active=1
            """),
            {"pid": platform_id},
        ).mappings().fetchone()
        return dict(row) if row else None

    def platform_id_from_token(self, token: str) -> Optional[int]:
        # Try short_name exact (case-insens), then name contains
        row = self.db.execute(
            text("""
                SELECT TOP 1 platform_id
                FROM dbo.Platforms
                WHERE is_active=1 AND LOWER(short_name)=LOWER(:t)
                ORDER BY platform_id
            """),
            {"t": token},
        ).fetchone()
        if row:
            return row[0]
        row = self.db.execute(
            text("""
                SELECT TOP 1 platform_id
                FROM dbo.Platforms
                WHERE is_active=1 AND LOWER(name) LIKE '%' + LOWER(:t) + '%'
                ORDER BY platform_id
            """),
            {"t": token},
        ).fetchone()
        return row[0] if row else None

    # ---------- Search

    def count_catalog(self, q_text: str, upc: Optional[str], category_id: Optional[int], platform_id: Optional[int]) -> int:
        if upc:
            row = self.db.execute(
                text("""
                    SELECT COUNT(*)
                    FROM dbo.CatalogProducts cp
                    WHERE cp.upc LIKE :upc
                """),
                {"upc": f"{upc}%"},
            ).fetchone()
            return int(row[0] or 0)

        row = self.db.execute(
            text("""
                SELECT COUNT(*)
                FROM dbo.CatalogProducts cp
                JOIN dbo.Categories c ON c.category_id = cp.category_id
                LEFT JOIN dbo.CatalogProductGames g ON g.catalog_product_id = cp.catalog_product_id
                WHERE (:cid IS NULL OR cp.category_id = :cid)
                  AND (:pid IS NULL OR g.platform_id = :pid)
                  AND (:q = '' OR cp.title LIKE '%' + :q + '%')
            """),
            {"cid": category_id, "pid": platform_id, "q": q_text},
        ).fetchone()
        return int(row[0] or 0)

    def search_catalog_page(
        self, q_text: str, upc: Optional[str], category_id: Optional[int], platform_id: Optional[int],
        limit: int, offset: int
    ) -> List[Dict]:
        if upc:
            rows = self.db.execute(
                text("""
                    SELECT cp.catalog_product_id, cp.title, cp.category_id, c.name AS category_name,
                           cp.brand, cp.upc,
                           g.platform_id, p.name AS platform_name, p.short_name
                    FROM dbo.CatalogProducts cp
                    JOIN dbo.Categories c ON c.category_id = cp.category_id
                    LEFT JOIN dbo.CatalogProductGames g ON g.catalog_product_id = cp.catalog_product_id
                    LEFT JOIN dbo.Platforms p ON p.platform_id = g.platform_id
                    WHERE cp.upc LIKE :upc
                    ORDER BY cp.title
                    OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
                """),
                {"upc": f"{upc}%", "offset": offset, "limit": limit},
            ).mappings().all()
            return [dict(r) for r in rows]

        rows = self.db.execute(
            text("""
                ;WITH base AS (
                  SELECT cp.catalog_product_id, cp.title, cp.category_id, c.name AS category_name,
                         cp.brand, cp.upc, g.platform_id, p.name AS platform_name, p.short_name,
                         CASE WHEN cp.title LIKE :q + '%' THEN 100 ELSE 0 END +
                         CASE WHEN cp.title LIKE '%' + :q + '%' THEN 20 ELSE 0 END +
                         CASE WHEN (:pid IS NOT NULL AND g.platform_id = :pid) THEN 50 ELSE 0 END
                         AS score
                  FROM dbo.CatalogProducts cp
                  JOIN dbo.Categories c ON c.category_id = cp.category_id
                  LEFT JOIN dbo.CatalogProductGames g ON g.catalog_product_id = cp.catalog_product_id
                  LEFT JOIN dbo.Platforms p ON p.platform_id = g.platform_id
                  WHERE (:cid IS NULL OR cp.category_id = :cid)
                    AND (:pid IS NULL OR g.platform_id = :pid)
                    AND (:q = '' OR cp.title LIKE '%' + :q + '%')
                )
                SELECT catalog_product_id, title, category_id, category_name,
                       brand, upc, platform_id, platform_name, short_name
                FROM base
                ORDER BY score DESC, title ASC, catalog_product_id ASC
                OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
            """),
            {"q": q_text, "cid": category_id, "pid": platform_id, "offset": offset, "limit": limit},
        ).mappings().all()
        return [dict(r) for r in rows]

    def variants_for_products(self, product_ids: List[int]) -> Dict[int, List[Dict]]:
        if not product_ids:
            return {}
        rows = self.db.execute(
            text(f"""
                SELECT v.variant_id, v.catalog_product_id, v.variant_type_id, vt.code AS variant_type_code,
                       vt.display_name, v.current_market_value, v.default_list_price
                FROM dbo.ListingVariants v
                JOIN dbo.VariantTypes vt ON vt.variant_type_id = v.variant_type_id
                WHERE v.is_active = 1 AND v.catalog_product_id IN ({",".join(str(i) for i in product_ids)})
                ORDER BY v.catalog_product_id, vt.display_name
            """)
        ).mappings().all()
        out: Dict[int, List[Dict]] = {}
        for r in rows:
            out.setdefault(r["catalog_product_id"], []).append(dict(r))
        return out

    # ---------- Create product (+ children if applicable)

    def insert_catalog_product(
        self, *,
        category_id: int,
        title: str,
        brand: Optional[str],
        upc: Optional[str],
        release_year: Optional[int],
        attributes_json: Optional[dict],
    ) -> int:
        # Serialize JSON once; pass as a parameter (NVARCHAR(MAX) in T-SQL)
        attrs_param = None if attributes_json is None else json.dumps(attributes_json, ensure_ascii=False)

        row = self.db.execute(
            text("""
                INSERT INTO dbo.CatalogProducts
                (category_id, title, brand, upc, release_year, attributes_json, created_at, updated_at)
                OUTPUT inserted.catalog_product_id
                VALUES
                (:category_id, :title, :brand, :upc, :release_year, :attrs, SYSDATETIME(), SYSDATETIME())
            """),
            {
                "category_id": category_id,
                "title": title,
                "brand": brand,
                "upc": upc,
                "release_year": release_year,
                "attrs": attrs_param,
            },
        ).fetchone()
        return int(row[0])

    def insert_game_child(self, catalog_product_id: int, platform_id: int):
        self.db.execute(
            text("""
                INSERT INTO dbo.CatalogProductGames (catalog_product_id, platform_id)
                VALUES (:id, :pid)
            """),
            {"id": catalog_product_id, "pid": platform_id},
        )

    def insert_console_child(self, catalog_product_id: int, model_number: str, storage_capacity_gb: Optional[int],
                             firmware_sensitive: bool):
        self.db.execute(
            text("""
                INSERT INTO dbo.CatalogProductConsoles
                  (catalog_product_id, model_number, storage_capacity_gb, firmware_sensitive)
                VALUES (:id, :model, :storage, :firmware)
            """),
            {"id": catalog_product_id, "model": model_number, "storage": storage_capacity_gb,
             "firmware": 1 if firmware_sensitive else 0},
        )

    # ---------- Create variant

    def insert_variant(self, catalog_product_id: int, variant_type_id: int,
                       default_list_price: Optional[float]) -> Dict:
        row = self.db.execute(
            text("""
                INSERT INTO dbo.ListingVariants
                  (catalog_product_id, variant_type_id, current_market_value, default_list_price,
                   is_active, created_at, updated_at)
                OUTPUT inserted.variant_id, inserted.catalog_product_id, inserted.variant_type_id,
                       inserted.current_market_value,
                       inserted.default_list_price, inserted.is_active
                VALUES (:cid, :vtid, NULL, :price, 1, SYSDATETIME(), SYSDATETIME())
            """),
            {"cid": catalog_product_id, "vtid": variant_type_id, "price": default_list_price},
        ).mappings().fetchone()

        # include variant_type_code
        vt = self.db.execute(
            text("SELECT code FROM dbo.VariantTypes WHERE variant_type_id=:id"),
            {"id": row["variant_type_id"]},
        ).fetchone()
        out = dict(row)
        out["variant_type_code"] = vt[0] if vt else None
        return out
    

    def get_product_context(self, catalog_product_id: int) -> Dict:
        row = self.db.execute(
            text("""
                SELECT cp.catalog_product_id, cp.title,cp.upc, cp.category_id, c.name AS category_name,
                       cp.pricecharting_id, cp.not_on_pc,
                       p.short_name AS platform_short
                FROM dbo.CatalogProducts cp
                JOIN dbo.Categories c ON c.category_id = cp.category_id
                LEFT JOIN dbo.CatalogProductGames g ON g.catalog_product_id = cp.catalog_product_id
                LEFT JOIN dbo.Platforms p ON p.platform_id = g.platform_id
                WHERE cp.catalog_product_id = :id
            """),
            {"id": catalog_product_id},
        ).mappings().fetchone()
        if not row:
            raise AppError(f"Catalog product {catalog_product_id} not found", 404)
        return dict(row)

    # --- link / unlink flags
    def set_pricecharting_id(self, catalog_product_id: int, pc_id: str):
        self.db.execute(
            text("""
                UPDATE dbo.CatalogProducts
                SET pricecharting_id = :pc, not_on_pc = 0, updated_at = SYSDATETIME()
                WHERE catalog_product_id = :id
            """),
            {"pc": pc_id, "id": catalog_product_id},
        )

    def set_not_on_pc(self, catalog_product_id: int, flag: bool):
        self.db.execute(
            text("""
                UPDATE dbo.CatalogProducts
                SET not_on_pc = :f, pricecharting_id = NULL, updated_at = SYSDATETIME()
                WHERE catalog_product_id = :id
            """),
            {"f": 1 if flag else 0, "id": catalog_product_id},
        )

    # --- variant helpers (upsert for LOOSE/OP/NEW)
    def variant_type_id_by_code(self, code: str) -> int:
        row = self.db.execute(
            text("SELECT variant_type_id FROM dbo.VariantTypes WHERE code = :code AND is_active=1"),
            {"code": code},
        ).fetchone()
        if not row:
            raise AppError(f"Variant type code {code} not found", 500)
        return int(row[0])

    def find_active_variant(self, catalog_product_id: int, variant_type_id: int) -> Optional[int]:
        row = self.db.execute(
            text("""
                SELECT TOP 1 variant_id
                FROM dbo.ListingVariants
                WHERE catalog_product_id = :cid
                  AND variant_type_id = :vtid
                  AND is_active = 1
                ORDER BY variant_id
            """),
            {"cid": catalog_product_id, "vtid": variant_type_id},
        ).fetchone()
        return int(row[0]) if row else None

    def create_variant_basic(self, catalog_product_id: int, variant_type_id: int) -> int:
        row = self.db.execute(
            text("""
                INSERT INTO dbo.ListingVariants
                  (catalog_product_id, variant_type_id,
                   current_market_value, default_list_price, is_active, created_at, updated_at)
                OUTPUT inserted.variant_id
                VALUES (:cid, :vtid, NULL, NULL, 1, SYSDATETIME(), SYSDATETIME())
            """),
            {"cid": catalog_product_id, "vtid": variant_type_id},
        ).fetchone()
        return int(row[0])

    def update_variant_market_value(self, variant_id: int, value: Optional[float]):
        self.db.execute(
            text("""
                UPDATE dbo.ListingVariants
                SET current_market_value = :v, updated_at = SYSDATETIME()
                WHERE variant_id = :vid
            """),
            {"v": value, "vid": variant_id},
        )

    def upsert_variant_and_value(self, catalog_product_id: int, vt_code: str, value: Optional[float]) -> Dict:
        vtid = self.variant_type_id_by_code(vt_code)
        vid = self.find_active_variant(catalog_product_id, vtid)
        if not vid:
            vid = self.create_variant_basic(catalog_product_id, vtid)
        self.update_variant_market_value(vid, value)
        return {"variant_id": vid, "variant_type_code": vt_code, "current_market_value": (float(value) if value is not None else None)}
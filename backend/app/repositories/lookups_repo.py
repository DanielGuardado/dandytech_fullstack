from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

class LookupsRepo:
    def __init__(self, db: Session):
        self.db = db

    # -------- Reads

    def list_sources(self) -> List[Dict]:
        rows = self.db.execute(
            text("""
                SELECT source_id, code, name, type, is_active
                FROM dbo.Sources
                WHERE is_active = 1
                ORDER BY code
            """)
        ).mappings().all()
        return [dict(r) for r in rows]

    def list_payment_methods(self) -> List[Dict]:
        rows = self.db.execute(
            text("""
                SELECT payment_method_id, code, display_name, is_active
                FROM dbo.PaymentMethods
                WHERE is_active = 1
                ORDER BY display_name
            """)
        ).mappings().all()
        return [dict(r) for r in rows]

    def list_categories(self) -> List[Dict]:
        rows = self.db.execute(
            text("""
                SELECT category_id, name
                FROM dbo.Categories
                WHERE is_active = 1
                ORDER BY name
            """)
        ).mappings().all()
        return [dict(r) for r in rows]

    def list_variant_types(self) -> List[Dict]:
        rows = self.db.execute(
            text("""
                SELECT variant_type_id, code, display_name, is_active
                FROM dbo.VariantTypes
                WHERE is_active = 1
                ORDER BY display_name
            """)
        ).mappings().all()
        return [dict(r) for r in rows]

    def list_condition_grades(self) -> List[Dict]:
        rows = self.db.execute(
            text("""
                SELECT condition_grade_id, code, display_name, rank
                FROM dbo.ConditionGrades
                WHERE is_active = 1
                ORDER BY rank, display_name
            """)
        ).mappings().all()
        return [dict(r) for r in rows]

    def list_platforms(self) -> List[Dict]:
        rows = self.db.execute(
            text("""
                SELECT platform_id, name, short_name, category_id, brand_id, default_markup
                FROM dbo.Platforms
                WHERE is_active = 1
                ORDER BY name
            """)
        ).mappings().all()
        return [dict(r) for r in rows]

    # -------- Existence checks (case-insensitive)

    def source_exists_code(self, code: str) -> bool:
        row = self.db.execute(
            text("""
                SELECT 1
                FROM dbo.Sources
                WHERE LOWER(code) = LOWER(:code)
            """),
            {"code": code}
        ).fetchone()
        return bool(row)

    def payment_method_exists_code(self, code: str) -> bool:
        row = self.db.execute(
            text("""
                SELECT 1
                FROM dbo.PaymentMethods
                WHERE LOWER(code) = LOWER(:code)
            """),
            {"code": code}
        ).fetchone()
        return bool(row)

    # -------- Inserts

    def insert_source(self, *, code: str, name: str, type_: str) -> Dict:
        row = self.db.execute(
            text("""
                INSERT INTO dbo.Sources (code, name, type, is_active, created_at)
                OUTPUT inserted.source_id, inserted.code, inserted.name, inserted.type, inserted.is_active
                VALUES (:code, :name, :type, 1, SYSDATETIME())
            """),
            {"code": code, "name": name, "type": type_}
        ).mappings().fetchone()
        return dict(row)

    def insert_payment_method(self, *, code: str, display_name: str) -> Dict:
        row = self.db.execute(
            text("""
                INSERT INTO dbo.PaymentMethods (code, display_name, is_active)
                OUTPUT inserted.payment_method_id, inserted.code, inserted.display_name, inserted.is_active
                VALUES (:code, :display_name, 1)
            """),
            {"code": code, "display_name": display_name}
        ).mappings().fetchone()
        return dict(row)

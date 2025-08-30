from __future__ import annotations
from typing import Any, Dict, List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.errors import AppError
ALLOWED_SORTS = {
    "updated_at": "ii.updated_at",
    "created_at": "ii.created_at",
    "po_number": "po.po_number",
    "title": "cp.title",
    "quantity": "ii.quantity",
    "list_price": "ii.list_price",
}
ALLOWED_PATCH_COLUMNS = {
    "seller_sku": "seller_sku",
    "list_price": "list_price",
    "condition_grade_id": "condition_grade_id",
    "title_suffix": "title_suffix",
    "location": "location",
}
class InventoryRepo:
    def __init__(self, db: Session):
        self.db = db

    def _build_where(self,
                     po_id: int | None,
                     status: str | None,
                     search: str | None,
                     platform: str | None,
                     variant_type: str | None,
                     location: str | None) -> tuple[str, Dict[str, Any]]:
        clauses: List[str] = ["1=1"]
        params: Dict[str, Any] = {}
        if po_id is not None:
            clauses.append("poi.purchase_order_id = :po_id")
            params["po_id"] = po_id
        if status:
            clauses.append("ii.status = :status")
            params["status"] = status
        if platform:
            clauses.append("p.short_name = :platform")
            params["platform"] = platform
        if variant_type:
            clauses.append("vt.code = :variant_type")
            params["variant_type"] = variant_type
        if location:
            clauses.append("ii.location = :location")
            params["location"] = location
        if search:
            clauses.append("(UPPER(ii.seller_sku) LIKE :term OR UPPER(cp.title) LIKE :term OR cp.upc LIKE :term_upc)")
            params["term"] = f"%{search.upper()}%"
            params["term_upc"] = f"%{search}%"  # UPC often numeric
        where_sql = " AND ".join(clauses)
        return where_sql, params

    def _order_by(self, sort: str | None) -> str:
        s = sort or "-updated_at"
        direction = "DESC" if s.startswith("-") else "ASC"
        key = s[1:] if s.startswith("-") else s
        column = ALLOWED_SORTS.get(key, "ii.updated_at")
        return f"{column} {direction}"

    def list_inventory(self,
                       po_id: int | None,
                       status: str | None,
                       search: str | None,
                       platform: str | None,
                       variant_type: str | None,
                       location: str | None,
                       page: int,
                       page_size: int,
                       sort: str | None) -> Tuple[int, List[Dict[str, Any]]]:
        where_sql, params = self._build_where(po_id, status, search, platform, variant_type, location)
        order_sql = self._order_by(sort)

        base_from = """
            FROM dbo.InventoryItems ii
            JOIN dbo.PurchaseOrderItems poi ON poi.purchase_order_item_id = ii.purchase_order_item_id
            JOIN dbo.PurchaseOrders po ON po.purchase_order_id = poi.purchase_order_id
            JOIN dbo.ListingVariants v ON v.variant_id = ii.variant_id
            JOIN dbo.VariantTypes vt ON vt.variant_type_id = v.variant_type_id
            JOIN dbo.CatalogProducts cp ON cp.catalog_product_id = poi.catalog_product_id
            JOIN dbo.Categories cat ON cat.category_id = cp.category_id
            LEFT JOIN dbo.CatalogProductGames g ON g.catalog_product_id = cp.catalog_product_id
            LEFT JOIN dbo.Platforms p ON p.platform_id = g.platform_id
            LEFT JOIN dbo.ConditionGrades cg ON cg.condition_grade_id = ii.condition_grade_id
            -- attribute profile joins (prefer category+variant match, else category-only)
            LEFT JOIN dbo.CategoryAttributeProfiles capv
              ON capv.category_id = cp.category_id AND capv.entity = 'inventory_item' AND capv.variant_type_id = v.variant_type_id
            LEFT JOIN dbo.AttributeProfiles apv ON apv.profile_id = capv.profile_id AND apv.is_active = 1
            LEFT JOIN dbo.CategoryAttributeProfiles capd
              ON capd.category_id = cp.category_id AND capd.entity = 'inventory_item' AND capd.variant_type_id IS NULL
            LEFT JOIN dbo.AttributeProfiles apd ON apd.profile_id = capd.profile_id AND apd.is_active = 1
        """

        count_sql = f"SELECT COUNT(1) {base_from} WHERE {where_sql}"
        total = int(self.db.execute(text(count_sql), params).scalar() or 0)

        offset = max(0, (page - 1) * page_size)
        data_sql = f"""
            SELECT
              ii.inventory_item_id,
              poi.purchase_order_id,
              po.po_number,
              poi.purchase_order_item_id,

              ii.seller_sku,
              ii.quantity,
              CASE WHEN ii.status = 'Active' THEN ii.quantity ELSE 0 END AS available,
              ii.status,
              ii.allocated_unit_cost,
              ii.list_price,

              ii.condition_grade_id,
              cg.code AS condition_grade_code,

              -- editable fields on the item
              ii.title_suffix,
              ii.unit_attributes_json,
              ii.location,

              -- product context
              cp.catalog_product_id,
              cp.category_id,
              cp.title AS product_title,
              cp.brand AS product_brand,
              cp.upc   AS product_upc,
              cat.name AS category_name,
              p.short_name AS platform_short,

              -- variant context
              v.variant_id,
              v.variant_type_id,
              vt.code AS variant_type_code,
              v.current_market_value AS variant_current_market_value,
              v.default_list_price  AS variant_default_list_price,

              -- profile hints
              COALESCE(capv.profile_id, capd.profile_id) AS profile_id,
              COALESCE(apv.version, apd.version) AS profile_version,
              CASE WHEN capv.profile_id IS NOT NULL THEN 'category+variant_type'
                   WHEN capd.profile_id IS NOT NULL THEN 'category_only'
                   ELSE 'none' END AS profile_matched_on,

              CAST(ii.created_at AS DATETIME2(3)) AS created_at,
              CAST(ii.updated_at AS DATETIME2(3)) AS updated_at
            {base_from}
            WHERE {where_sql}
            ORDER BY {order_sql}
            OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
        """
        params_with_page = dict(params)
        params_with_page.update({"offset": offset, "limit": page_size})
        rows = self.db.execute(text(data_sql), params_with_page).mappings().all()
        items = [dict(r) for r in rows]
        return total, items
    
    def get_inventory_detail(self, inventory_item_id: int) -> Optional[Dict[str, Any]]:
        sql = text(
            """
            SELECT
              ii.inventory_item_id,
              poi.purchase_order_id,
              po.po_number,
              poi.purchase_order_item_id,

              ii.seller_sku,
              ii.quantity,
              CASE WHEN ii.status = 'Active' THEN ii.quantity ELSE 0 END AS available,
              ii.status,
              ii.allocated_unit_cost,
              ii.list_price,

              ii.condition_grade_id,
              cg.code AS condition_grade_code,

              -- editable fields on the item
              ii.title_suffix,
              ii.unit_attributes_json,
              ii.location,

              -- product context
              cp.catalog_product_id,
              cp.category_id,
              cp.title AS product_title,
              cp.brand AS product_brand,
              cp.upc   AS product_upc,
              cat.name AS category_name,
              p.short_name AS platform_short,

              -- variant context
              v.variant_id,
              v.variant_type_id,
              vt.code AS variant_type_code,
              v.current_market_value AS variant_current_market_value,
              v.default_list_price  AS variant_default_list_price,

              -- profile hints (same precedence as list)
              COALESCE(capv.profile_id, capd.profile_id) AS profile_id,
              COALESCE(apv.version, apd.version) AS profile_version,
              CASE WHEN capv.profile_id IS NOT NULL THEN 'category+variant_type'
                   WHEN capd.profile_id IS NOT NULL THEN 'category_only'
                   ELSE 'none' END AS profile_matched_on,

              CAST(ii.created_at AS DATETIME2(3)) AS created_at,
              CAST(ii.updated_at AS DATETIME2(3)) AS updated_at
            FROM dbo.InventoryItems ii
            JOIN dbo.PurchaseOrderItems poi ON poi.purchase_order_item_id = ii.purchase_order_item_id
            JOIN dbo.PurchaseOrders po ON po.purchase_order_id = poi.purchase_order_id
            JOIN dbo.ListingVariants v ON v.variant_id = ii.variant_id
            JOIN dbo.VariantTypes vt ON vt.variant_type_id = v.variant_type_id
            JOIN dbo.CatalogProducts cp ON cp.catalog_product_id = poi.catalog_product_id
            JOIN dbo.Categories cat ON cat.category_id = cp.category_id
            LEFT JOIN dbo.CatalogProductGames g ON g.catalog_product_id = cp.catalog_product_id
            LEFT JOIN dbo.Platforms p ON p.platform_id = g.platform_id
            LEFT JOIN dbo.ConditionGrades cg ON cg.condition_grade_id = ii.condition_grade_id
            LEFT JOIN dbo.CategoryAttributeProfiles capv
              ON capv.category_id = cp.category_id AND capv.entity = 'inventory_item' AND capv.variant_type_id = v.variant_type_id
            LEFT JOIN dbo.AttributeProfiles apv ON apv.profile_id = capv.profile_id AND apv.is_active = 1
            LEFT JOIN dbo.CategoryAttributeProfiles capd
              ON capd.category_id = cp.category_id AND capd.entity = 'inventory_item' AND capd.variant_type_id IS NULL
            LEFT JOIN dbo.AttributeProfiles apd ON apd.profile_id = capd.profile_id AND apd.is_active = 1
            WHERE ii.inventory_item_id = :id
            """
        )
        row = self.db.execute(sql, {"id": inventory_item_id}).mappings().fetchone()
        return dict(row) if row else None
    
    def get_item_for_adjust(self, inventory_item_id: int) -> Optional[Dict[str, Any]]:
        row = self.db.execute(text(
            """
            SELECT ii.inventory_item_id, ii.quantity, ii.status,
                   CAST(ii.updated_at AS DATETIME2(3)) AS updated_at
            FROM dbo.InventoryItems ii
            WHERE ii.inventory_item_id = :id
            """
        ), {"id": inventory_item_id}).mappings().fetchone()
        return dict(row) if row else None

    def update_item_qty_status(self, inventory_item_id: int, new_qty: int, new_status: str) -> None:
        res = self.db.execute(text(
            """
            UPDATE dbo.InventoryItems
               SET quantity = :q,
                   status   = :s,
                   updated_at = SYSDATETIME()
             WHERE inventory_item_id = :id
            """
        ), {"q": new_qty, "s": new_status, "id": inventory_item_id})
        if res.rowcount != 1:
            raise AppError("Failed to update inventory item", 500)

    def insert_inventory_event(self,
                               inventory_item_id: int,
                               reason: str,
                               delta: int,
                               qty_before: int,
                               qty_after: int,
                               from_status: str,
                               to_status: str,
                               notes: Optional[str]) -> int:
        row = self.db.execute(text(
            """
            INSERT INTO dbo.InventoryEvents(
              inventory_item_id, event_type, reason, delta,
              quantity_before, quantity_after, from_status, to_status, notes)
            OUTPUT INSERTED.inventory_event_id
            VALUES(:id, 'adjust', :reason, :delta, :qb, :qa, :fs, :ts, :notes)
            """
        ), {
            "id": inventory_item_id,
            "reason": reason,
            "delta": delta,
            "qb": qty_before,
            "qa": qty_after,
            "fs": from_status,
            "ts": to_status,
            "notes": notes,
        }).scalar()
        return int(row)
    
    def condition_grade_exists(self, grade_id: int) -> bool:
        val = self.db.execute(text("SELECT 1 FROM dbo.ConditionGrades WHERE condition_grade_id = :g"), {"g": grade_id}).scalar()
        return bool(val)

    def patch_item(self, inventory_item_id: int, fields: Dict[str, Any]) -> None:
        if not fields:
            return
        sets = []
        params: Dict[str, Any] = {"id": inventory_item_id}

        for key, col in ALLOWED_PATCH_COLUMNS.items():
            if key in fields:
                sets.append(f"{col} = :{key}")
                params[key] = fields[key]

        if not sets:
            return

        set_sql = ",\n               ".join(sets)
        sql = text(f"""
            UPDATE dbo.InventoryItems
            SET {set_sql},
                updated_at = SYSDATETIME()
            WHERE inventory_item_id = :id
        """)
        res = self.db.execute(sql, params)
        if res.rowcount != 1:
            raise AppError("Inventory item not found or not updated", 404)
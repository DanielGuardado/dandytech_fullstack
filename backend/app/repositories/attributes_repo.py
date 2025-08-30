from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.errors import AppError

class AttributesRepo:
    def __init__(self, db: Session):
        self.db = db

    # --- resolution helpers ---
    def _profile_by_category(self, *, entity: str, category_id: int, variant_type_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        # try category+variant, then category only
        if variant_type_id is not None:
            row = self.db.execute(text(
                """
                SELECT ap.*
                FROM dbo.CategoryAttributeProfiles cap
                JOIN dbo.AttributeProfiles ap ON ap.profile_id = cap.profile_id AND ap.is_active = 1
                WHERE cap.entity = :entity AND cap.category_id = :cat AND cap.variant_type_id = :vt
                """
            ), {"entity": entity, "cat": category_id, "vt": variant_type_id}).mappings().fetchone()
            if row:
                d = dict(row); d["matched_on"] = "category+variant_type"; return d
        row = self.db.execute(text(
            """
            SELECT ap.*
            FROM dbo.CategoryAttributeProfiles cap
            JOIN dbo.AttributeProfiles ap ON ap.profile_id = cap.profile_id AND ap.is_active = 1
            WHERE cap.entity = :entity AND cap.category_id = :cat AND cap.variant_type_id IS NULL
            """
        ), {"entity": entity, "cat": category_id}).mappings().fetchone()
        if row:
            d = dict(row); d["matched_on"] = "category_only"; return d
        return None

    def resolve_for_inventory_item(self, inventory_item_id: int) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        # find category (+ variant type if desired later)
        row = self.db.execute(text(
            """
            SELECT cp.category_id, v.variant_type_id
            FROM dbo.InventoryItems ii
            JOIN dbo.PurchaseOrderItems poi ON poi.purchase_order_item_id = ii.purchase_order_item_id
            JOIN dbo.CatalogProducts cp ON cp.catalog_product_id = poi.catalog_product_id
            JOIN dbo.ListingVariants v ON v.variant_id = ii.variant_id
            WHERE ii.inventory_item_id = :id
            """
        ), {"id": inventory_item_id}).mappings().fetchone()
        if not row:
            raise AppError(f"Inventory item {inventory_item_id} not found", 404)
        profile = self._profile_by_category(entity="inventory_item", category_id=int(row["category_id"]), variant_type_id=int(row["variant_type_id"]) if row["variant_type_id"] is not None else None)
        if not profile:
            raise AppError("No attribute profile mapped for this category/entity", 404)
        fields = self.list_fields(profile_id=int(profile["profile_id"]))
        return profile, fields

    def resolve_by_context(self, *, entity: str, category_id: int, variant_type_id: Optional[int] = None) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        profile = self._profile_by_category(entity=entity, category_id=category_id, variant_type_id=variant_type_id)
        if not profile:
            raise AppError("No attribute profile mapped for this category/entity", 404)
        fields = self.list_fields(profile_id=int(profile["profile_id"]))
        return profile, fields

    def list_fields(self, profile_id: int) -> List[Dict[str, Any]]:
        rows = self.db.execute(text(
            """
            SELECT field_id, key_name, data_type, is_required,
                   enum_values_json, regex, min_value, max_value,
                   default_value, display_label, display_help, display_group, display_order
            FROM dbo.AttributeProfileFields
            WHERE profile_id = :p
            ORDER BY COALESCE(display_order, 9999), key_name
            """
        ), {"p": profile_id}).mappings().all()
        return [dict(r) for r in rows]

    # --- inventory item persistence ---
    def get_item_attrs(self, inventory_item_id: int) -> Dict[str, Any]:
        row = self.db.execute(text(
            "SELECT unit_attributes_json, CAST(updated_at AS DATETIME2(3)) AS updated_at FROM dbo.InventoryItems WHERE inventory_item_id = :id"
        ), {"id": inventory_item_id}).mappings().fetchone()
        if not row:
            raise AppError(f"Inventory item {inventory_item_id} not found", 404)
        return {"unit_attributes_json": row["unit_attributes_json"], "updated_at": row["updated_at"]}

    def update_item_attrs(self, inventory_item_id: int, unit_attributes_json: str) -> None:
        self.db.execute(text(
            """
            UPDATE dbo.InventoryItems
               SET unit_attributes_json = :j,
                   updated_at = SYSDATETIME()
             WHERE inventory_item_id = :id
            """
        ), {"j": unit_attributes_json, "id": inventory_item_id})
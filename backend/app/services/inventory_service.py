from __future__ import annotations
from typing import Any, Dict, List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.schemas.inventory import InventoryListItem, InventoryListResponse
from app.repositories.inventory_repo import InventoryRepo
from app.schemas.attributes import AttributeProfileDto, AttributeField
from app.repositories.attributes_repo import AttributesRepo
from app.schemas.inventory_detail import InventoryDetailResponse

class InventoryService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = InventoryRepo(db)

    def list_items(self,
                   po_id: int | None,
                   status: str | None,
                   search: str | None,
                   platform: str | None,
                   variant_type: str | None,
                   location: str | None,
                   page: int,
                   page_size: int,
                   sort: str | None,
                   include_profiles: str | None = None) -> InventoryListResponse:
        page = page or 1
        page_size = min(max(page_size or 50, 1), 200)

        total, rows = self.repo.list_inventory(po_id, status, search, platform, variant_type, location, page, page_size, sort)

        items: List[InventoryListItem] = []
        profile_ids: set[int] = set()

        for r in rows:
            if r.get("profile_id") is not None:
                profile_ids.add(int(r["profile_id"]))
            items.append(InventoryListItem(
                inventory_item_id=r["inventory_item_id"],
                purchase_order_id=r["purchase_order_id"],
                po_number=r["po_number"],
                purchase_order_item_id=r["purchase_order_item_id"],
                seller_sku=r["seller_sku"],
                quantity=int(r["quantity"]),
                available=int(r["available"]),
                status=r["status"],
                allocated_unit_cost=float(r["allocated_unit_cost"]),
                list_price=(float(r["list_price"]) if r["list_price"] is not None else None),
                condition_grade_id=int(r["condition_grade_id"]),
                condition_grade_code=r.get("condition_grade_code"),
                title_suffix=r.get("title_suffix"),
                unit_attributes_json=r.get("unit_attributes_json"),
                location=r.get("location"),
                catalog_product_id=int(r["catalog_product_id"]),
                category_id=int(r["category_id"]),
                product_title=r["product_title"],
                category_name=r["category_name"],
                platform_short=r.get("platform_short"),
                product_brand=r.get("product_brand"),
                product_upc=r.get("product_upc"),
                variant_id=int(r["variant_id"]),
                variant_type_id=(int(r["variant_type_id"]) if r.get("variant_type_id") is not None else None),
                variant_type_code=r["variant_type_code"],
                variant_current_market_value=(float(r["variant_current_market_value"]) if r["variant_current_market_value"] is not None else None),
                variant_default_list_price=(float(r["variant_default_list_price"]) if r["variant_default_list_price"] is not None else None),
                profile_id=(int(r["profile_id"]) if r.get("profile_id") is not None else None),
                profile_version=(int(r["profile_version"]) if r.get("profile_version") is not None else None),
                profile_matched_on=r.get("profile_matched_on"),
                created_at=r["created_at"].isoformat(timespec="milliseconds") if hasattr(r["created_at"], "isoformat") else str(r["created_at"]),
                updated_at=r["updated_at"].isoformat(timespec="milliseconds") if hasattr(r["updated_at"], "isoformat") else str(r["updated_at"]),
            ))

        profiles_map: Optional[Dict[str, AttributeProfileDto]] = None
        if (include_profiles or "none").lower() == "full" and profile_ids:
            profiles_map = {}
            attr_repo = AttributesRepo(self.db)
            import json as _json
            for pid in sorted(profile_ids):
                # fetch profile meta
                row = self.db.execute(
                    text("SELECT profile_id, name, entity, version FROM dbo.AttributeProfiles WHERE profile_id = :p AND is_active = 1"),
                    {"p": pid},
                ).mappings().fetchone()
                if not row:
                    continue
                fields = attr_repo.list_fields(profile_id=pid)
                # build DTO
                profiles_map[str(pid)] = AttributeProfileDto(
                    profile_id=int(row["profile_id"]),
                    name=row["name"],
                    entity=row["entity"],
                    version=int(row["version"]),
                    matched_on="",  # not meaningful in batch
                    fields=[
                        AttributeField(
                            key_name=f["key_name"],
                            data_type=f["data_type"],
                            is_required=bool(f["is_required"]),
                            enum_values=(None if not f.get("enum_values_json") else _json.loads(f["enum_values_json"])),
                            regex=f.get("regex"),
                            min_value=float(f["min_value"]) if f.get("min_value") is not None else None,
                            max_value=float(f["max_value"]) if f.get("max_value") is not None else None,
                            display_label=f.get("display_label"),
                            display_help=f.get("display_help"),
                            display_group=f.get("display_group"),
                            display_order=int(f["display_order"]) if f.get("display_order") is not None else None,
                        ) for f in fields
                    ],
                )

        return InventoryListResponse(page=page, page_size=page_size, total=total, items=items, profiles=profiles_map)
    
    def get_item_detail(self, inventory_item_id: int, include_profile: bool = True) -> InventoryDetailResponse:
        r = self.repo.get_inventory_detail(inventory_item_id)
        if not r:
            from app.core.errors import AppError
            raise AppError(f"Inventory item {inventory_item_id} not found", 404)

        item = InventoryListItem(
            inventory_item_id=r["inventory_item_id"],
            purchase_order_id=r["purchase_order_id"],
            po_number=r["po_number"],
            purchase_order_item_id=r["purchase_order_item_id"],
            seller_sku=r["seller_sku"],
            quantity=int(r["quantity"]),
            available=int(r["available"]),
            status=r["status"],
            allocated_unit_cost=float(r["allocated_unit_cost"]),
            list_price=(float(r["list_price"]) if r["list_price"] is not None else None),
            condition_grade_id=int(r["condition_grade_id"]),
            condition_grade_code=r.get("condition_grade_code"),
            title_suffix=r.get("title_suffix"),
            unit_attributes_json=r.get("unit_attributes_json"),
            location=r.get("location"),
            catalog_product_id=int(r["catalog_product_id"]),
            category_id=int(r["category_id"]),
            product_title=r["product_title"],
            category_name=r["category_name"],
            platform_short=r.get("platform_short"),
            product_brand=r.get("product_brand"),
            product_upc=r.get("product_upc"),
            variant_id=int(r["variant_id"]),
            variant_type_id=(int(r["variant_type_id"]) if r.get("variant_type_id") is not None else None),
            variant_type_code=r["variant_type_code"],
            packaging_type=r.get("packaging_type"),
            variant_current_market_value=(float(r["variant_current_market_value"]) if r["variant_current_market_value"] is not None else None),
            variant_default_list_price=(float(r["variant_default_list_price"]) if r["variant_default_list_price"] is not None else None),
            profile_id=(int(r["profile_id"]) if r.get("profile_id") is not None else None),
            profile_version=(int(r["profile_version"]) if r.get("profile_version") is not None else None),
            profile_matched_on=r.get("profile_matched_on"),
            created_at=r["created_at"].isoformat(timespec="milliseconds") if hasattr(r["created_at"], "isoformat") else str(r["created_at"]),
            updated_at=r["updated_at"].isoformat(timespec="milliseconds") if hasattr(r["updated_at"], "isoformat") else str(r["updated_at"]),
        )

        profile_dto = None
        if include_profile and item.profile_id is not None:
            # load fields for this profile
            attr_repo = AttributesRepo(self.db)
            row = self.db.execute(
                text("SELECT profile_id, name, entity, version FROM dbo.AttributeProfiles WHERE profile_id = :p AND is_active = 1"),
                {"p": item.profile_id},
            ).mappings().fetchone()
            if row:
                fields = attr_repo.list_fields(profile_id=item.profile_id)
                import json as _json
                profile_dto = AttributeProfileDto(
                    profile_id=int(row["profile_id"]),
                    name=row["name"],
                    entity=row["entity"],
                    version=int(row["version"]),
                    matched_on=item.profile_matched_on or "",
                    fields=[
                        AttributeField(
                            key_name=f["key_name"],
                            data_type=f["data_type"],
                            is_required=bool(f["is_required"]),
                            enum_values=(None if not f.get("enum_values_json") else _json.loads(f["enum_values_json"])),
                            regex=f.get("regex"),
                            min_value=float(f["min_value"]) if f.get("min_value") is not None else None,
                            max_value=float(f["max_value"]) if f.get("max_value") is not None else None,
                            display_label=f.get("display_label"),
                            display_help=f.get("display_help"),
                            display_group=f.get("display_group"),
                            display_order=int(f["display_order"]) if f.get("display_order") is not None else None,
                        ) for f in fields
                    ],
                )

        return InventoryDetailResponse(item=item, profile=profile_dto)
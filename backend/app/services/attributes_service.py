from __future__ import annotations
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.repositories.attributes_repo import AttributesRepo
from app.schemas.attributes import AttributeField, AttributeProfileDto

class AttributesService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AttributesRepo(db)

    def resolve_for_inventory_item(self, inventory_item_id: int) -> AttributeProfileDto:
        profile, fields = self.repo.resolve_for_inventory_item(inventory_item_id)
        return self._dto(profile, fields)

    def resolve_by_context(self, entity: str, category_id: int, variant_type_id: Optional[int]) -> AttributeProfileDto:
        profile, fields = self.repo.resolve_by_context(entity=entity, category_id=category_id, variant_type_id=variant_type_id)
        return self._dto(profile, fields)

    def _dto(self, profile: Dict[str, Any], fields: List[Dict[str, Any]]) -> AttributeProfileDto:
        return AttributeProfileDto(
            profile_id=int(profile["profile_id"]),
            name=profile["name"],
            entity=profile["entity"],
            version=int(profile["version"]),
            matched_on=profile.get("matched_on", "unknown"),
            fields=[
                AttributeField(
                    key_name=f["key_name"],
                    data_type=f["data_type"],
                    is_required=bool(f["is_required"]),
                    enum_values=(None if not f.get("enum_values_json") else __import__("json").loads(f["enum_values_json"])),
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
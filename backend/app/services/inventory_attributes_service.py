from __future__ import annotations
from typing import Any, Dict
import json, re
from sqlalchemy.orm import Session
from app.core.errors import AppError
from app.repositories.attributes_repo import AttributesRepo
from app.schemas.inventory_attributes import UpdateInventoryAttributesRequest, UpdateInventoryAttributesResponse
from app.services.attributes_service import AttributesService

class InventoryAttributesService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AttributesRepo(db)
        self.attr_service = AttributesService(db)

    def resolve_profile(self, inventory_item_id: int):
        return self.attr_service.resolve_for_inventory_item(inventory_item_id)

    def update_attributes(self, inventory_item_id: int, payload: UpdateInventoryAttributesRequest) -> UpdateInventoryAttributesResponse:
        # resolve effective profile by category for this inventory item
        with self.db.begin():

            profile = self.attr_service.resolve_for_inventory_item(inventory_item_id)

            # validate
            errors: Dict[str, str] = {}
            data: Dict[str, Any] = payload.unit_attributes_json or {}

            def is_bool(v):
                return isinstance(v, bool)
            def is_text(v):
                return v is None or isinstance(v, str)
            def is_string(v):
                return v is None or isinstance(v, str)
            def is_int(v):
                return v is None or isinstance(v, int)
            def is_decimal(v):
                return v is None or isinstance(v, (int, float))
            def is_date(v):
                return v is None or isinstance(v, str)  # ISO date; deeper parse optional

            type_checks = {
                'bool': is_bool,
                'text': is_text,
                'string': is_string,
                'int': is_int,
                'decimal': is_decimal,
                'date': is_date,
                'enum': is_string,
            }

            for f in profile.fields:
                key = f.key_name
                present = key in data and data[key] is not None
                if f.is_required and not present:
                    errors[key] = 'required'
                    continue
                if key in data:
                    check = type_checks.get(f.data_type, is_text)
                    if not check(data[key]):
                        errors[key] = f'invalid_{f.data_type}'
                        continue
                    if f.regex and isinstance(data[key], str) and not re.fullmatch(f.regex, data[key]):
                        errors[key] = 'regex_mismatch'
                        continue
                    if f.data_type == 'enum' and f.enum_values and data[key] is not None and data[key] not in f.enum_values:
                        errors[key] = 'invalid_enum_value'
                        continue

            if errors:
                raise AppError("Attribute validation failed", 400, details=errors)

            # persist
            j = json.dumps(data, separators=(',', ':'))
            self.repo.update_item_attrs(inventory_item_id, j)
            row = self.repo.get_item_attrs(inventory_item_id)
            updated_at_iso = row['updated_at'].isoformat(timespec='milliseconds') if hasattr(row['updated_at'], 'isoformat') else str(row['updated_at'])
        return UpdateInventoryAttributesResponse(
            inventory_item_id=inventory_item_id,
            updated_at=updated_at_iso,
            unit_attributes_json=data,
            profile_id=profile.profile_id,
            profile_version=profile.version,
        )
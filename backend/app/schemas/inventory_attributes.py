from __future__ import annotations
from typing import Any, Dict
from pydantic import BaseModel

class UpdateInventoryAttributesRequest(BaseModel):
    unit_attributes_json: Dict[str, Any]

class UpdateInventoryAttributesResponse(BaseModel):
    inventory_item_id: int
    updated_at: str
    unit_attributes_json: Dict[str, Any]
    profile_id: int
    profile_version: int
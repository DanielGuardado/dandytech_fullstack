from __future__ import annotations
from typing import Optional
from pydantic import BaseModel
from app.schemas.inventory import InventoryListItem
from app.schemas.attributes import AttributeProfileDto

class InventoryDetailResponse(BaseModel):
    item: InventoryListItem
    profile: Optional[AttributeProfileDto] = None 
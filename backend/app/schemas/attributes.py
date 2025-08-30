from __future__ import annotations
from typing import List, Optional, Dict
from pydantic import BaseModel

class AttributeField(BaseModel):
    key_name: str
    data_type: str   # bool|text|string|int|decimal|date|enum
    is_required: bool
    enum_values: Optional[List[str]] = None
    regex: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    display_label: Optional[str] = None
    display_help: Optional[str] = None
    display_group: Optional[str] = None
    display_order: Optional[int] = None

class AttributeProfileDto(BaseModel):
    profile_id: int
    name: str
    entity: str
    version: int
    matched_on: str
    fields: List[AttributeField]
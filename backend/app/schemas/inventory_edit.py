from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field, validator

class PatchInventoryItemRequest(BaseModel):
    seller_sku: Optional[str] = Field(None, max_length=100)
    list_price: Optional[float] = Field(None, ge=0)
    condition_grade_id: Optional[int] = Field(None, ge=1)
    title_suffix: Optional[str] = Field(None, max_length=120)
    location: Optional[str] = Field(None, max_length=120)

    @validator("seller_sku", "title_suffix", "location")
    def trim_strings(cls, v):
        if v is None:
            return v
        v = v.strip()
        return v or None 
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field

ALLOWED_REASONS = {"cycle_count", "damage", "loss", "correction", "found"}
ALLOWED_STATUSES = {"Pending", "Active", "Damaged", "Archived"}

class AdjustInventoryRequest(BaseModel):
    delta: int = Field(..., description="Signed quantity delta; can be 0 for status-only transitions")
    reason: str = Field(..., description=f"One of: {', '.join(sorted(ALLOWED_REASONS))}")
    set_status: Optional[str] = Field(None, description=f"Optional new status; one of: {', '.join(sorted(ALLOWED_STATUSES))}")
    notes: Optional[str] = Field(None, max_length=500)
    auto_archive_when_zero: Optional[bool] = True
    enforce_attributes_on_active: Optional[bool] = True
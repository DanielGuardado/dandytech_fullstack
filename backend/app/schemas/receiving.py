from __future__ import annotations
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import datetime

class StagingItem(BaseModel):
    purchase_order_item_id: int
    variant_id: int
    catalog_product_id: int

    quantity_expected: int
    quantity_received: int
    remaining: int
    receive_status: str

    allocated_unit_cost: Optional[float] = None
    allocation_basis: float
    allocation_basis_source: str
    current_market_value: Optional[float] = None

    product_title: str
    category_name: str
    platform_short: Optional[str] = None
    variant_type_code: str

    updated_at: str  # ISO string for optimistic concurrency later

    sku_parts: dict
    receivable: bool

class StagingTemplateResponse(BaseModel):
    purchase_order_id: int
    po_number: str
    status: str
    is_locked: bool
    counts: dict
    items: List[StagingItem]

class ReceivingCommitItem(BaseModel):
    purchase_order_item_id: int
    qty_to_receive: int = Field(ge=0)


    # optional custom sku (if not provided, will be auto-generated)
    sku: Optional[str] = None
    
    damaged: bool = False
    short: bool = False
    updated_at: datetime # from staging template


class ReceivingCommitRequest(BaseModel):
    purchase_order_id: int
    items: List[ReceivingCommitItem]


class ReceivingCommitResponse(BaseModel):
    inventory_item_ids: List[int]
    po_progress: dict
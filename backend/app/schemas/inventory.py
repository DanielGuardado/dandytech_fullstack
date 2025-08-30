from __future__ import annotations
from typing import List, Optional, Dict
from pydantic import BaseModel
from app.schemas.attributes import AttributeProfileDto

class InventoryListItem(BaseModel):
    inventory_item_id: int
    purchase_order_id: int
    po_number: str
    purchase_order_item_id: int

    seller_sku: str
    quantity: int
    available: int  # quantity if status == 'Active' else 0
    status: str
    allocated_unit_cost: float
    list_price: Optional[float] = None

    condition_grade_id: int
    condition_grade_code: Optional[str] = None

    # Editable fields on the item
    title_suffix: Optional[str] = None
    unit_attributes_json: Optional[str] = None
    location: Optional[str] = None

    # product/variant context
    catalog_product_id: int
    category_id: int
    product_title: str
    category_name: str
    platform_short: Optional[str] = None
    product_brand: Optional[str] = None
    product_upc: Optional[str] = None

    variant_id: int
    variant_type_id: Optional[int] = None
    variant_type_code: str
    variant_current_market_value: Optional[float] = None
    variant_default_list_price: Optional[float] = None

    # profile hints for dynamic attributes rendering
    profile_id: Optional[int] = None
    profile_version: Optional[int] = None
    profile_matched_on: Optional[str] = None  # 'category+variant_type' | 'category_only' | 'none'

    created_at: str
    updated_at: str

class InventoryListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: List[InventoryListItem]
    profiles: Optional[Dict[str, AttributeProfileDto]] = None
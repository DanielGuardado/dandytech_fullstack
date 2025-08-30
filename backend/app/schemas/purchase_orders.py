from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import date, datetime

# -------- Create PO

class POCreate(BaseModel):
    source_id: int
    date_purchased: Optional[date] = None
    payment_method_id: Optional[int] = None
    external_order_number: Optional[str] = None
    subtotal: float = 0
    tax: float = 0
    shipping: float = 0
    fees: float = 0
    discounts: float = 0
    notes: Optional[str] = None

class POReturn(BaseModel):
    purchase_order_id: int
    po_number: str
    status: str
    is_locked: bool
    total_cost: float
    lines: List[dict] = []

# -------- Add PO Line

class POLineCreate(BaseModel):
    variant_id: int
    catalog_product_id: int
    quantity_expected: int = Field(..., ge=0)
    allocation_basis: Optional[float] = Field(None, ge=0)  # used if PC not available
    allocation_basis_source: Optional[str] = None          # 'pricecharting'|'ebay_sold'|'other'
    cost_assignment_method: Optional[str] = None           # 'by_market_value'|'manual'
    allocated_unit_cost: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None



# ---------- Lines (shared)
class POLine(BaseModel):
    purchase_order_item_id: int
    purchase_order_id: int
    variant_id: int
    catalog_product_id: int
    quantity_expected: int
    quantity_received: int
    allocation_basis: float
    allocation_basis_source: str
    cost_assignment_method: str
    allocated_unit_cost: Optional[float] = None
    receive_status: str
    updated_at: Optional[str] = None
    product_title: Optional[str] = None
    variant_type_code: Optional[str] = None
    variant_display_name: Optional[str] = None

class POLineReturn(BaseModel):
    purchase_order_item_id: int
    purchase_order_id: int
    variant_id: int
    catalog_product_id: int
    quantity_expected: int
    quantity_received: int
    allocation_basis: float
    allocation_basis_source: str
    cost_assignment_method: str
    allocated_unit_cost: Optional[float] = None
    receive_status: str
    updated_at: Optional[str] = None
    product_title: Optional[str] = None
    variant_type_code: Optional[str] = None
    variant_display_name: Optional[str] = None

# ---------- Lock response
class POLockResponse(BaseModel):
    purchase_order_id: int
    po_number: str
    status: str
    is_locked: bool
    lines: List[POLine]

# ---------- List / detail
class PORow(BaseModel):
    purchase_order_id: int
    po_number: str
    source_id: int
    status: str
    is_locked: bool
    subtotal: float
    tax: float
    shipping: float
    fees: float
    discounts: float
    total_cost: float
    created_at: datetime

class POListResponse(BaseModel):
    items: List[PORow]
    total: int
    limit: int
    offset: int

class PODetail(BaseModel):
    purchase_order_id: int
    po_number: str
    source_id: int
    status: str
    is_locked: bool
    subtotal: float
    tax: float
    shipping: float
    fees: float
    discounts: float
    total_cost: float
    payment_method_id: Optional[int] = None
    external_order_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: List[POLine]

# ---------- Update schemas
class POUpdate(BaseModel):
    date_purchased: Optional[date] = None
    payment_method_id: Optional[int] = None
    external_order_number: Optional[str] = None
    subtotal: Optional[float] = Field(None, ge=0)
    tax: Optional[float] = Field(None, ge=0)
    shipping: Optional[float] = Field(None, ge=0)
    fees: Optional[float] = Field(None, ge=0)
    discounts: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None

class POLineUpdate(BaseModel):
    quantity_expected: Optional[int] = Field(None, ge=0)
    allocation_basis: Optional[float] = Field(None, ge=0)
    allocation_basis_source: Optional[str] = None
    cost_assignment_method: Optional[str] = None
    allocated_unit_cost: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None
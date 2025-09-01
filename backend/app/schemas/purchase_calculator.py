from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from decimal import Decimal

# -------- Configuration Schemas

class CalculatorConfig(BaseModel):
    config_key: str
    config_value: float
    config_type: str  # 'percentage' or 'amount'
    description: Optional[str] = None
    updated_at: Optional[datetime] = None

class CalculatorConfigUpdate(BaseModel):
    config_value: float = Field(..., ge=0)

class CalculatorConfigBatchUpdate(BaseModel):
    configs: Dict[str, float] = Field(..., description="Dictionary of config_key to config_value")

class PlatformMarkupUpdate(BaseModel):
    default_markup: float = Field(..., ge=0)

# -------- Session Schemas

class CalculatorSessionCreate(BaseModel):
    session_name: Optional[str] = None
    source_id: Optional[int] = None
    asking_price: Optional[float] = Field(None, ge=0, description="Total asking price for the entire lot")

class CalculatorSessionUpdate(BaseModel):
    session_name: Optional[str] = None
    source_id: Optional[int] = None
    status: Optional[str] = Field(None, pattern="^(draft|finalized|converted_to_po)$")
    asking_price: Optional[float] = Field(None, ge=0, description="Total asking price for the entire lot")
    cashback_enabled: Optional[bool] = Field(None, description="Whether to include cashback in calculations")
    tax_exempt: Optional[bool] = Field(None, description="Whether this session is tax exempt")

class CalculatorSession(BaseModel):
    session_id: int
    session_name: Optional[str] = None
    source_id: Optional[int] = None
    total_items: int = 0
    total_market_value: Optional[float] = None
    total_estimated_revenue: Optional[float] = None
    total_purchase_price: Optional[float] = None
    expected_profit: Optional[float] = None
    expected_profit_margin: Optional[float] = None
    status: str
    purchase_order_id: Optional[int] = None
    asking_price: Optional[float] = None
    cashback_enabled: bool = True
    tax_exempt: bool = True
    created_at: datetime
    updated_at: datetime

class CalculatorSessionDetail(CalculatorSession):
    items: List['CalculatorItem'] = []
    source_name: Optional[str] = None

# -------- Item Schemas

class CalculatorItemCreate(BaseModel):
    catalog_product_id: Optional[int] = None
    variant_id: Optional[int] = None
    product_title: Optional[str] = None
    variant_type_code: Optional[str] = None
    pricecharting_id: Optional[str] = None
    market_price: Optional[float] = Field(None, ge=0)
    override_price: Optional[float] = Field(None, ge=0)
    markup_amount: Optional[float] = Field(None, ge=0)
    deductions: Optional[float] = Field(None, ge=0, description="Total amount to deduct from estimated sale price")
    deduction_reasons: Optional[Dict[str, float]] = Field(None, description="Dictionary of reason to amount deductions")
    has_manual: Optional[bool] = Field(None, description="Whether CIB item includes manual")
    shipping_cost: float = Field(..., ge=0, description="Shipping cost for this item (0 is valid for free shipping)")
    target_profit_percentage: float = Field(25.0, ge=0, le=100)
    quantity: int = Field(1, ge=1)
    notes: Optional[str] = None

class CalculatorItemUpdate(BaseModel):
    override_price: Optional[float] = Field(None, ge=0)
    markup_amount: Optional[float] = Field(None, ge=0)
    deductions: Optional[float] = Field(None, ge=0, description="Total amount to deduct from estimated sale price")
    deduction_reasons: Optional[Dict[str, float]] = Field(None, description="Dictionary of reason to amount deductions")
    has_manual: Optional[bool] = Field(None, description="Whether CIB item includes manual")
    shipping_cost: Optional[float] = Field(None, ge=0, description="Shipping cost for this item")
    target_profit_percentage: Optional[float] = Field(None, ge=0, le=100)
    quantity: Optional[int] = Field(None, ge=1)
    notes: Optional[str] = None

class CalculatorItem(BaseModel):
    model_config = {"from_attributes": True}
    
    item_id: int
    session_id: int
    catalog_product_id: Optional[int] = None
    variant_id: Optional[int] = None
    product_title: Optional[str] = None
    variant_type_code: Optional[str] = None
    pricecharting_id: Optional[str] = None
    market_price: Optional[float] = None
    override_price: Optional[float] = None
    final_base_price: Optional[float] = None
    cost_source: Optional[str] = None
    markup_amount: Optional[float] = None
    deductions: Optional[float] = None
    deduction_reasons: Optional[str] = None  # JSON string in database
    has_manual: Optional[bool] = None
    estimated_sale_price: Optional[float] = None
    total_fees: Optional[float] = None
    net_after_fees: Optional[float] = None
    target_profit_percentage: float = 25.0
    calculated_purchase_price: Optional[float] = None
    quantity: int = 1
    notes: Optional[str] = None
    created_at: datetime
    
    # Detailed calculation breakdown fields
    sales_tax: Optional[float] = None
    final_value: Optional[float] = None
    base_variable_fee: Optional[float] = None
    discounted_variable_fee: Optional[float] = None
    transaction_fee: Optional[float] = None
    ad_fee: Optional[float] = None
    shipping_cost: Optional[float] = None
    supplies_cost: Optional[float] = None
    regular_cashback: Optional[float] = None
    shipping_cashback: Optional[float] = None
    total_cashback: Optional[float] = None
    
    # Additional fields for UI display
    platform_name: Optional[str] = None
    platform_short_name: Optional[str] = None
    

# -------- Calculation Schemas

class ItemCalculationRequest(BaseModel):
    base_price: float = Field(..., ge=0)
    markup_amount: float = Field(..., ge=0)
    target_profit_percentage: float = Field(25.0, ge=0, le=100)
    category_name: str  # For determining fee structure
    quantity: int = Field(1, ge=1)

class ItemCalculationResponse(BaseModel):
    estimated_sale_price: float
    total_fees: float
    net_after_fees: float
    calculated_purchase_price: float
    profit_per_item: float
    profit_margin_percentage: float

class SessionCalculationSummary(BaseModel):
    total_items: int
    total_quantity: int
    total_market_value: float
    total_estimated_revenue: float
    total_purchase_price: float
    total_fees: float
    expected_profit: float
    expected_profit_margin: float

# -------- Conversion Schemas

class ConvertToPORequest(BaseModel):
    po_date_purchased: Optional[str] = None  # ISO date string
    external_order_number: Optional[str] = None
    notes: Optional[str] = None

class ConvertToPOResponse(BaseModel):
    purchase_order_id: int
    po_number: str
    items_converted: int
    session_id: int

# -------- List Response Schemas

class CalculatorSessionListResponse(BaseModel):
    items: List[CalculatorSession]
    total: int
    limit: Optional[int] = None
    offset: Optional[int] = None

# Update forward references for CalculatorSessionDetail
CalculatorSessionDetail.model_rebuild()
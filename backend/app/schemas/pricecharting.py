from typing import List, Optional
from pydantic import BaseModel

# --- GET /catalog/{id}/pricecharting/search
class PCSearchResult(BaseModel):
    id: str
    title: str
    platform: Optional[str] = None

class PCSearchResponse(BaseModel):
    query_used: str
    results: List[PCSearchResult]

# --- POST /catalog/{id}/pricecharting/link
class PCLinkRequest(BaseModel):
    pricecharting_id: str
    create_variants: bool = True  # keep true by default

class LinkedVariant(BaseModel):
    variant_id: int
    variant_type_code: str
    current_market_value: Optional[float] = None
    platform_short: Optional[str] = None
    platform_manual_sensitive: Optional[bool] = None

class PCLinkResponse(BaseModel):
    catalog_product_id: int
    pricecharting_id: str
    not_on_pc: bool
    variants: List[LinkedVariant]

# --- POST /catalog/{id}/pricecharting/not-on-pc
class NotOnPCResponse(BaseModel):
    catalog_product_id: int
    pricecharting_id: Optional[str] = None
    not_on_pc: bool

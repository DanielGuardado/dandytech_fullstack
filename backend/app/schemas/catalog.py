from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator

# ---------- Search

class CatalogSearchResponseItemVariant(BaseModel):
    variant_id: int
    variant_type_id: int
    variant_type_code: str
    display_name: str
    current_market_value: Optional[float] = None
    default_list_price: Optional[float] = None

class CatalogSearchResponseItem(BaseModel):
    catalog_product_id: int
    title: str
    category_id: int
    category_name: str
    brand: Optional[str] = None
    upc: Optional[str] = None
    platform: Optional[Dict[str, Any]] = None
    variants: List[CatalogSearchResponseItemVariant]

class CatalogSearchResponse(BaseModel):
    items: List[CatalogSearchResponseItem]
    total: int
    limit: int
    offset: int

# ---------- Create Product

class GameChild(BaseModel):
    platform_id: int

class ConsoleChild(BaseModel):
    model_number: Optional[str] = None
    storage_capacity_gb: Optional[int] = None
    firmware_sensitive: Optional[bool] = False
    region_default: Optional[str] = None

class CatalogProductCreate(BaseModel):
    category_id: int
    title: str
    brand: Optional[str] = None
    upc: Optional[str] = None
    release_year: Optional[int] = None
    attributes_json: Optional[dict] = None
    # children (only when applicable)
    game: Optional[GameChild] = None
    console: Optional[ConsoleChild] = None

class CatalogProductCreateResponse(BaseModel):
    catalog_product_id: int
    category_id: int
    title: str
    upc: Optional[str] = None
    created_children: List[str] = []

# ---------- Create Variant

class ListingVariantCreate(BaseModel):
    variant_type_id: int
    default_list_price: Optional[float] = None

class ListingVariantCreateResponse(BaseModel):
    variant_id: int
    catalog_product_id: int
    variant_type_id: int
    variant_type_code: str
    current_market_value: Optional[float] = None
    default_list_price: Optional[float] = None
    is_active: bool

# ---------- Brands

class Brand(BaseModel):
    brand_id: int
    name: str

class BrandsResponse(BaseModel):
    items: List[Brand]
    total: int

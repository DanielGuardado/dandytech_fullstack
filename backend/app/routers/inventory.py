from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.db import get_db
from app.schemas.inventory import InventoryListResponse
from app.services.inventory_service import InventoryService
from app.schemas.inventory_detail import InventoryDetailResponse
from app.schemas.inventory_adjust import AdjustInventoryRequest
from app.services.inventory_adjust_service import InventoryAdjustService
from app.schemas.inventory_edit import PatchInventoryItemRequest
from app.services.inventory_edit_service import InventoryEditService



router = APIRouter()

@router.get("/items", response_model=InventoryListResponse, summary="List inventory items with optional filters and profile hints")
def list_inventory_items(
    po_id: Optional[int] = Query(None, description="Filter by purchase_order_id"),
    status: Optional[str] = Query(None, description="Inventory status (Pending, Active, Damaged, etc.)"),
    search: Optional[str] = Query(None, description="Search seller_sku, product title, or UPC"),
    platform: Optional[str] = Query(None, description="Platform short name, e.g. PS3"),
    variant_type: Optional[str] = Query(None, description="Variant type code, e.g. LOOSE"),
    location: Optional[str] = Query(None, description="Exact bin/location string"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort: Optional[str] = Query("-updated_at", description="Sort by -updated_at (default), updated_at, created_at, po_number, title, quantity, list_price; prefix with '-' for DESC"),
    include_profiles: Optional[str] = Query("none", description="Set to 'full' to include deduped profile field definitions used by rows"),
    db: Session = Depends(get_db),
):
    service = InventoryService(db)
    return service.list_items(po_id, status, search, platform, variant_type, location, page, page_size, sort, include_profiles)

@router.get("/items/{inventory_item_id}", response_model=InventoryDetailResponse, summary="Get a single inventory item (with profile)")
def get_inventory_item(
    inventory_item_id: int,
    include_profile: bool = Query(True, description="Whether to include resolved attribute profile fields"),
    db: Session = Depends(get_db),
):
    service = InventoryService(db)
    return service.get_item_detail(inventory_item_id, include_profile=include_profile)



@router.post("/items/{inventory_item_id}/adjust", response_model=InventoryDetailResponse, summary="Adjust quantity and/or status of an inventory item")
def adjust_inventory_item(
    inventory_item_id: int,
    payload: AdjustInventoryRequest,
    db: Session = Depends(get_db),
):
    svc = InventoryAdjustService(db)
    return svc.adjust(inventory_item_id, payload)

@router.patch("/items/{inventory_item_id}", response_model=InventoryDetailResponse, summary="Inline edit fields on an inventory item")
def patch_inventory_item(
    inventory_item_id: int,
    payload: PatchInventoryItemRequest,
    db: Session = Depends(get_db),
):
    svc = InventoryEditService(db)
    return svc.patch(inventory_item_id, payload)
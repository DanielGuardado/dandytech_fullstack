from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.schemas.inventory_attributes import UpdateInventoryAttributesRequest, UpdateInventoryAttributesResponse
from app.services.inventory_attributes_service import InventoryAttributesService

router = APIRouter(prefix="/inventory/items", tags=["Inventory"])

@router.put("/{inventory_item_id}/attributes", response_model=UpdateInventoryAttributesResponse)
def update_inventory_item_attributes(
    inventory_item_id: int = Path(..., ge=1),
    payload: UpdateInventoryAttributesRequest = ...,
    db: Session = Depends(get_db),
):
    return InventoryAttributesService(db).update_attributes(inventory_item_id, payload)
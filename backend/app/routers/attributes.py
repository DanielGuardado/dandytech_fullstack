from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.schemas.attributes import AttributeProfileDto
from app.services.attributes_service import AttributesService

router = APIRouter(prefix="/attributes/profiles", tags=["Attributes"])

@router.get("/resolve", response_model=AttributeProfileDto)
def resolve_profile(
    inventory_item_id: Optional[int] = Query(None),
    entity: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    variant_type_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    svc = AttributesService(db)
    if inventory_item_id is not None:
        return svc.resolve_for_inventory_item(inventory_item_id)
    if entity and category_id:
        return svc.resolve_by_context(entity=entity, category_id=category_id, variant_type_id=variant_type_id)
    # neither form provided
    from app.core.errors import AppError
    raise AppError("Provide either inventory_item_id OR entity+category_id", 400)
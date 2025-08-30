from fastapi import APIRouter, Depends,Path, Query
from typing import Optional
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.services.purchase_order_service import PurchaseOrderService
from app.schemas.purchase_orders import POLineCreate, POLineReturn,POCreate, POLockResponse, POListResponse, PODetail, POUpdate, POLineUpdate

router = APIRouter()

@router.post("")
def create_po(payload: POCreate, db: Session = Depends(get_db)):
    return PurchaseOrderService(db).create_po(payload)


@router.post("/{po_id}/items", response_model=POLineReturn, status_code=201)
def add_po_line(po_id: int = Path(..., ge=1), payload: POLineCreate = ..., db: Session = Depends(get_db)):
    return PurchaseOrderService(db).add_po_line(po_id, payload)


@router.post("/{po_id}/lock", response_model=POLockResponse)
def lock_po(po_id: int = Path(..., ge=1), db: Session = Depends(get_db)):
    return PurchaseOrderService(db).lock_po(po_id)

@router.get("", response_model=POListResponse)
def list_pos(
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None, description="open | partially_received | received | closed_with_exceptions | returned | cancelled"),
    source_id: Optional[int] = Query(None, ge=1),
    is_locked: Optional[bool] = Query(None, description="Filter by locked status: 1 for locked POs, 0 for unlocked"),
    db: Session = Depends(get_db),
):
    return PurchaseOrderService(db).list_pos(limit=limit, offset=offset, status=status, source_id=source_id, is_locked=is_locked)

@router.get("/{po_id}", response_model=PODetail)
def get_po(po_id: int = Path(..., ge=1), db: Session = Depends(get_db)):
    return PurchaseOrderService(db).get_po(po_id)

@router.put("/{po_id}", response_model=PODetail)
def update_po(po_id: int = Path(..., ge=1), payload: POUpdate = ..., db: Session = Depends(get_db)):
    return PurchaseOrderService(db).update_po(po_id, payload)

@router.put("/{po_id}/items/{item_id}", response_model=POLineReturn)
def update_po_line(po_id: int = Path(..., ge=1), item_id: int = Path(..., ge=1), payload: POLineUpdate = ..., db: Session = Depends(get_db)):
    return PurchaseOrderService(db).update_po_line(po_id, item_id, payload)

@router.delete("/{po_id}/items/{item_id}", status_code=204)
def delete_po_line(po_id: int = Path(..., ge=1), item_id: int = Path(..., ge=1), db: Session = Depends(get_db)):
    PurchaseOrderService(db).delete_po_line(po_id, item_id)
    return
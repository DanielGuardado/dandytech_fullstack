from fastapi import APIRouter, Depends, Path, Query
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.services.purchase_calculator_service import PurchaseCalculatorService
from app.schemas.purchase_calculator import (
    CalculatorConfig,
    CalculatorConfigBatchUpdate,
    PlatformMarkupUpdate,
    CalculatorSessionCreate,
    CalculatorSessionUpdate,
    CalculatorSession,
    CalculatorSessionDetail,
    CalculatorSessionListResponse,
    CalculatorItemCreate,
    CalculatorItemUpdate,
    CalculatorItem,
    ConvertToPORequest,
    ConvertToPOResponse
)

router = APIRouter()

# -------- Configuration Endpoints --------

@router.get("/calculator/config", response_model=Dict[str, CalculatorConfig])
def get_config(db: Session = Depends(get_db)):
    """Get all calculator configuration values"""
    service = PurchaseCalculatorService(db)
    return service.get_config()

@router.put("/calculator/config", response_model=Dict[str, CalculatorConfig])
def update_config(payload: CalculatorConfigBatchUpdate, db: Session = Depends(get_db)):
    """Update calculator configuration values"""
    service = PurchaseCalculatorService(db)
    return service.update_config(payload.configs)

@router.put("/platforms/{platform_id}/markup", response_model=Dict[str, Any])
def update_platform_markup(
    platform_id: int = Path(..., ge=1),
    payload: PlatformMarkupUpdate = ...,
    db: Session = Depends(get_db)
):
    """Update platform default markup"""
    service = PurchaseCalculatorService(db)
    return service.update_platform_markup(platform_id, payload.default_markup)

# -------- Session Management --------

@router.post("/calculator/sessions", response_model=CalculatorSession, status_code=201)
def create_session(payload: CalculatorSessionCreate, db: Session = Depends(get_db)):
    """Create a new calculator session"""
    service = PurchaseCalculatorService(db)
    return service.create_session(payload.session_name, payload.source_id, payload.asking_price)

@router.get("/calculator/sessions", response_model=CalculatorSessionListResponse)
def list_sessions(
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None, regex="^(draft|finalized|converted_to_po)$"),
    db: Session = Depends(get_db)
):
    """List calculator sessions"""
    service = PurchaseCalculatorService(db)
    result = service.list_sessions(limit=limit, offset=offset, status=status)
    return {**result, "limit": limit, "offset": offset}

@router.get("/calculator/sessions/{session_id}", response_model=CalculatorSessionDetail)
def get_session(session_id: int = Path(..., ge=1), db: Session = Depends(get_db)):
    """Get session details with items"""
    service = PurchaseCalculatorService(db)
    return service.get_session(session_id)

@router.put("/calculator/sessions/{session_id}", response_model=CalculatorSession)
def update_session(
    session_id: int = Path(..., ge=1),
    payload: CalculatorSessionUpdate = ...,
    db: Session = Depends(get_db)
):
    """Update session details"""
    service = PurchaseCalculatorService(db)
    updates = payload.dict(exclude_unset=True)
    result = service.update_session(session_id, **updates)
    return result

@router.delete("/calculator/sessions/{session_id}", status_code=204)
def delete_session(session_id: int = Path(..., ge=1), db: Session = Depends(get_db)):
    """Delete calculator session"""
    service = PurchaseCalculatorService(db)
    service.delete_session(session_id)

# -------- Item Management --------

@router.post("/calculator/sessions/{session_id}/items", response_model=CalculatorItem, status_code=201)
def add_item(
    session_id: int = Path(..., ge=1),
    payload: CalculatorItemCreate = ...,
    db: Session = Depends(get_db)
):
    """Add item to calculator session"""
    service = PurchaseCalculatorService(db)
    item_data = payload.dict(exclude_unset=True)
    return service.add_item(session_id, item_data)

@router.put("/calculator/sessions/{session_id}/items/{item_id}", response_model=CalculatorItem)
def update_item(
    session_id: int = Path(..., ge=1),
    item_id: int = Path(..., ge=1),
    payload: CalculatorItemUpdate = ...,
    db: Session = Depends(get_db)
):
    """Update calculator item"""
    service = PurchaseCalculatorService(db)
    updates = payload.dict(exclude_unset=True)
    return service.update_item(session_id, item_id, updates)

@router.delete("/calculator/sessions/{session_id}/items/{item_id}", status_code=204)
def delete_item(
    session_id: int = Path(..., ge=1),
    item_id: int = Path(..., ge=1),
    db: Session = Depends(get_db)
):
    """Delete calculator item"""
    service = PurchaseCalculatorService(db)
    service.delete_item(session_id, item_id)

# -------- Calculation Operations --------

@router.post("/calculator/sessions/{session_id}/recalculate", response_model=CalculatorSessionDetail)
def recalculate_session(session_id: int = Path(..., ge=1), db: Session = Depends(get_db)):
    """Recalculate all items in session"""
    service = PurchaseCalculatorService(db)
    result = service.recalculate_session(session_id)
    return result

# -------- Purchase Order Conversion --------

@router.post("/calculator/sessions/{session_id}/convert-to-po", response_model=ConvertToPOResponse)
def convert_to_purchase_order(
    session_id: int = Path(..., ge=1),
    payload: ConvertToPORequest = ...,
    db: Session = Depends(get_db)
):
    """Convert calculator session to purchase order"""
    service = PurchaseCalculatorService(db)
    po_data = payload.dict(exclude_unset=True)
    return service.convert_to_purchase_order(session_id, po_data)
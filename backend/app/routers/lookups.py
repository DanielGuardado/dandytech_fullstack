from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.services.lookups_services import LookupsService
from app.schemas.lookups import SourceCreate, PaymentMethodCreate

router = APIRouter()

@router.get("")
def get_lookups(db: Session = Depends(get_db)):
    return LookupsService(db).get_lookups()

@router.post("/sources", status_code=201)
def create_source(payload: SourceCreate, db: Session = Depends(get_db)):
    return LookupsService(db).create_source(code=payload.code, name=payload.name, type_=payload.type)

@router.post("/payment-methods", status_code=201)
def create_payment_method(payload: PaymentMethodCreate, db: Session = Depends(get_db)):
    return LookupsService(db).create_payment_method(code=payload.code, display_name=payload.display_name)

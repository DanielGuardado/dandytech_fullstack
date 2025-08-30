from typing import Optional
from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.services.pricecharting_service import PriceChartingService
from app.schemas.pricecharting import (
    PCSearchResponse, PCLinkRequest, PCLinkResponse, NotOnPCResponse
)

router = APIRouter()

@router.get("/catalog/{catalog_product_id}/pricecharting/search", response_model=PCSearchResponse)
def pc_search(
    catalog_product_id: int = Path(..., ge=1),
    q: Optional[str] = Query(None),
    platform: Optional[str] = Query(None, description="Platform name or short name to include in search"),
    db: Session = Depends(get_db),
):
    return PriceChartingService(db).search(catalog_product_id, q, platform)

@router.post("/catalog/{catalog_product_id}/pricecharting/link", response_model=PCLinkResponse)
def pc_link(
    catalog_product_id: int = Path(..., ge=1),
    payload: PCLinkRequest = ...,
    db: Session = Depends(get_db),
):
    return PriceChartingService(db).link(
        catalog_product_id,
        pricecharting_id=payload.pricecharting_id,
        create_variants=payload.create_variants,
    )

@router.post("/catalog/{catalog_product_id}/pricecharting/not-on-pc", response_model=NotOnPCResponse)
def pc_not_on_pc(
    catalog_product_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    return PriceChartingService(db).not_on_pc(catalog_product_id)

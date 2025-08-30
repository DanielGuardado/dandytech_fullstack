from typing import Optional
from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.services.catalog_services import CatalogService
from app.schemas.catalog import (
    CatalogSearchResponse, CatalogProductCreate, CatalogProductCreateResponse,
    ListingVariantCreate, ListingVariantCreateResponse
)

router = APIRouter()

@router.get("/search", response_model=CatalogSearchResponse)
def search_catalog(
    q: Optional[str] = Query(None, description="Free text, e.g. 'red dead redemption ps4'"),
    upc: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    platform_id: Optional[int] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return CatalogService(db).search(
        q=q, upc=upc, category_id=category_id, platform_id=platform_id, limit=limit, offset=offset
    )

@router.post("/products", response_model=CatalogProductCreateResponse, status_code=201)
def create_catalog_product(payload: CatalogProductCreate, db: Session = Depends(get_db)):
    return CatalogService(db).create_product(payload)

@router.post("/products/{catalog_product_id}/variants", response_model=ListingVariantCreateResponse, status_code=201)
def create_variant(
    catalog_product_id: int = Path(..., ge=1),
    payload: ListingVariantCreate = ...,
    db: Session = Depends(get_db),
):
    return CatalogService(db).create_variant(catalog_product_id, payload)

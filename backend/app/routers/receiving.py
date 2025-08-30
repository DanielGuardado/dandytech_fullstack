from fastapi import APIRouter, Depends, Query, Body
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.receiving import (
    StagingTemplateResponse,
    ReceivingCommitRequest,
    ReceivingCommitResponse,
)
from app.services.receiving_service import ReceivingService

router = APIRouter() 


@router.get(
    "/staging-template",
    response_model=StagingTemplateResponse,
    summary="Build receiving staging template for a locked PO",
)
def get_staging_template(
    po_id: int = Query(..., description="Purchase order id"),
    include_non_receivable: bool = Query(False, description="Include lines with remaining <= 0"),
    db: Session = Depends(get_db),
):
    """Return receivable lines with product/variant context and a sku preview.
    Requires the PO to be locked; otherwise returns HTTP 409 from the service.
    """
    service = ReceivingService(db)
    return service.build_staging_template(po_id, include_non_receivable)


@router.post(
    "/commit",
    response_model=ReceivingCommitResponse,
    summary="Commit receiving for one purchase order (single transaction)",
)
def commit_receiving(
    payload: ReceivingCommitRequest = Body(...),
    db: Session = Depends(get_db),
):
    """Create inventory cohorts, log receiving events, update PO line statuses,
    and refresh PO header status. Enforces optimistic concurrency via `updated_at`.
    """
    service = ReceivingService(db)
    return service.commit_receiving(payload)
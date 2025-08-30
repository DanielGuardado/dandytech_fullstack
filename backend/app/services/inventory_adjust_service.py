from __future__ import annotations
from typing import Optional
from sqlalchemy.orm import Session
from app.core.errors import AppError
from app.repositories.inventory_repo import InventoryRepo
from app.schemas.inventory_adjust import AdjustInventoryRequest, ALLOWED_REASONS, ALLOWED_STATUSES
from app.services.inventory_service import InventoryService

class InventoryAdjustService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = InventoryRepo(db)
        self.detail_service = InventoryService(db)

    def adjust(self, inventory_item_id: int, req: AdjustInventoryRequest):
        # validate reason and status enums
        reason = (req.reason or "").strip().lower()
        if reason not in ALLOWED_REASONS:
            raise AppError(f"Invalid reason '{req.reason}'. Allowed: {', '.join(sorted(ALLOWED_REASONS))}", 400)
        new_status_explicit: Optional[str] = None
        if req.set_status is not None:
            if req.set_status not in ALLOWED_STATUSES:
                raise AppError(f"Invalid status '{req.set_status}'. Allowed: {', '.join(sorted(ALLOWED_STATUSES))}", 400)
            new_status_explicit = req.set_status

        # load current item
        with self.db.begin():

            row = self.repo.get_item_for_adjust(inventory_item_id)
            if not row:
                raise AppError(f"Inventory item {inventory_item_id} not found", 404)

            qty_before = int(row["quantity"]) if row["quantity"] is not None else 0
            status_before = row["status"]

            # compute new quantity
            delta = int(req.delta)
            qty_after = qty_before + delta
            if qty_after < 0:
                raise AppError("Insufficient quantity for this adjustment", 400)

            # decide new status
            if new_status_explicit is not None:
                status_after = new_status_explicit
            elif (req.auto_archive_when_zero is None or req.auto_archive_when_zero) and qty_after == 0:
                status_after = "Archived"
            else:
                status_after = status_before

            # NOTE: Attribute profile validation on Active is intentionally skipped per MVP

        # persist changes + event atomically
            self.repo.update_item_qty_status(inventory_item_id, qty_after, status_after)
            self.repo.insert_inventory_event(
                inventory_item_id=inventory_item_id,
                reason=reason,
                delta=delta,
                qty_before=qty_before,
                qty_after=qty_after,
                from_status=status_before,
                to_status=status_after,
                notes=req.notes,
            )

        # return fresh detail (includes profile hints)
        return self.detail_service.get_item_detail(inventory_item_id, include_profile=True)
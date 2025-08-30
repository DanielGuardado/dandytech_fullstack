from __future__ import annotations
from typing import List
from sqlalchemy.orm import Session
from app.core.errors import AppError
from app.schemas.receiving import (
    StagingTemplateResponse, StagingItem,
    ReceivingCommitRequest, ReceivingCommitResponse,
)
from app.repositories.receiving_repo import ReceivingRepo

class ReceivingService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ReceivingRepo(db)

    # --------- GET /receiving/staging-template ---------
    def build_staging_template(self, po_id: int, include_non_receivable: bool = False) -> StagingTemplateResponse:
        po_number, status, is_locked = self.repo.get_po_header(po_id)
        if not is_locked:
            raise AppError("PO must be locked before staging", 409)

        rows = self.repo.fetch_staging_rows(po_id, include_non_receivable)
        items: List[StagingItem] = []
        receivable_count = 0

        for r in rows:
            poi = int(r["purchase_order_item_id"])
            remaining = max(0, int(r["remaining"]))
            receivable = remaining > 0
            receivable_count += 1 if receivable else 0

            dt = r["updated_at"]  # this is a Python datetime from CAST(... AS DATETIME2(3))
            updated_at = dt.isoformat(timespec="milliseconds")

            items.append(StagingItem(
                purchase_order_item_id=r["purchase_order_item_id"],
                variant_id=r["variant_id"],
                catalog_product_id=r["catalog_product_id"],
                quantity_expected=int(r["quantity_expected"]),
                quantity_received=int(r["quantity_received"]),
                remaining=remaining,
                receive_status=r["receive_status"],
                allocated_unit_cost=float(r["allocated_unit_cost"]) if r["allocated_unit_cost"] is not None else None,
                allocation_basis=float(r["allocation_basis"]),
                allocation_basis_source=r["allocation_basis_source"],
                current_market_value=float(r["current_market_value"]) if r["current_market_value"] is not None else None,
                product_title=r["product_title"],
                category_name=r["category_name"],
                platform_short=r["platform_short"],
                variant_type_code=r["variant_type_code"],
                updated_at=updated_at,
                sku_parts={
                    "po_number": r["po_number"],
                    "po_item_id_padded": f"{poi:04d}",
                    "sku_preview": f"{r['po_number']}__{poi:04d}",
                },
                receivable=receivable,
            ))

        return StagingTemplateResponse(
            purchase_order_id=po_id,
            po_number=po_number,
            status=status,
            is_locked=is_locked,
            counts={"total": len(rows), "receivable": receivable_count},
            items=items,
        )

    # --------- POST /receiving/commit ---------
    def commit_receiving(self, req: ReceivingCommitRequest) -> ReceivingCommitResponse:
        created_ids: List[int] = []

        with self.db.begin():
            po_number, _, is_locked = self.repo.get_po_header(req.purchase_order_id)
            if not is_locked:
                raise AppError("PO must be locked before receiving", 409)

            unknown_cond_id = self.repo.get_unknown_condition_grade_id()
            for item in req.items:
                ctx = self.repo.get_po_item_context(item.purchase_order_item_id)
                if ctx["purchase_order_id"] != req.purchase_order_id:
                    raise AppError(
                        f"PO item {item.purchase_order_item_id} does not belong to PO {req.purchase_order_id}",
                        400,
                    )

                remaining_before = max(0, int(ctx["quantity_expected"]) - int(ctx["quantity_received"]))
                if item.qty_to_receive < 0:
                    raise AppError("qty_to_receive cannot be negative", 400)
                if item.qty_to_receive == 0:
                    continue

                seller_sku = item.sku or self._build_sku_simple(po_number, ctx["purchase_order_item_id"])
                if self.repo.seller_sku_exists(seller_sku):
                    raise AppError(f"seller_sku '{seller_sku}' already exists", 409)

                status = "Damaged" if item.damaged else "Pending"
                alloc_cost = float(ctx["allocated_unit_cost"]) if ctx["allocated_unit_cost"] is not None else 0.0
                inv_id = self.repo.insert_inventory_item(
                    purchase_order_item_id=ctx["purchase_order_item_id"],
                    variant_id=ctx["variant_id"],
                    seller_sku=seller_sku,
                    quantity=item.qty_to_receive,
                    allocated_unit_cost=alloc_cost,
                    condition_grade_id=unknown_cond_id,
                    status=status,
                )
                created_ids.append(inv_id)

                # Events: receive (+damage, +overage, +short)
                self.repo.insert_event(
                    purchase_order_id=req.purchase_order_id,
                    purchase_order_item_id=ctx["purchase_order_item_id"],
                    variant_id=ctx["variant_id"],
                    event_type="receive",
                    quantity=item.qty_to_receive,
                )
                if item.damaged:
                    self.repo.insert_event(
                        purchase_order_id=req.purchase_order_id,
                        purchase_order_item_id=ctx["purchase_order_item_id"],
                        variant_id=ctx["variant_id"],
                        event_type="damage",
                        quantity=item.qty_to_receive,
                    )
                overage = max(0, item.qty_to_receive - remaining_before)
                if overage > 0:
                    self.repo.insert_event(
                        purchase_order_id=req.purchase_order_id,
                        purchase_order_item_id=ctx["purchase_order_item_id"],
                        variant_id=ctx["variant_id"],
                        event_type="overage",
                        quantity=overage,
                    )

                new_received_total = int(ctx["quantity_received"]) + int(item.qty_to_receive)
                if item.short and new_received_total < int(ctx["quantity_expected"]):
                    new_status = "short"
                    short_qty = max(0, int(ctx["quantity_expected"]) - new_received_total)
                    if short_qty > 0:
                        self.repo.insert_event(
                            purchase_order_id=req.purchase_order_id,
                            purchase_order_item_id=ctx["purchase_order_item_id"],
                            variant_id=ctx["variant_id"],
                            event_type="short",
                            quantity=short_qty,
                        )
                elif new_received_total >= int(ctx["quantity_expected"]):
                    new_status = "received"
                elif new_received_total > 0:
                    new_status = "partial"
                else:
                    new_status = ctx["receive_status"] or "pending"

                expected_dt = item.updated_at.replace(tzinfo=None)
                self.repo.update_poi_receive(
                    purchase_order_item_id=ctx["purchase_order_item_id"],
                    qty_delta=item.qty_to_receive,
                    new_status=new_status,
                    expected_updated_at=expected_dt
                )

            # refresh header status
            self.repo.refresh_po_status(req.purchase_order_id)

        progress = self.repo.get_progress(req.purchase_order_id)
        return ReceivingCommitResponse(inventory_item_ids=created_ids, po_progress=progress)

    # ---- helpers ----
    def _build_sku_simple(self, po_number: str, purchase_order_item_id: int) -> str:
        return f"{po_number}{purchase_order_item_id:04d}"

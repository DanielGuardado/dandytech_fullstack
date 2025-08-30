from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app.core.errors import AppError
from app.repositories.purchase_orders_repo import PurchaseOrdersRepo
from app.integrations.pricecharting_client import PriceChartingClient
from app.ops.allocation import run_allocation_proc

def _pc_bucket_from_variant_type(code: str | None) -> str | None:
    if not code:
        return None
    c = code.upper()
    if c == "LOOSE":
        return "Loose"
    if c in ("ORIGINAL_PACKAGING", "CIB"):
        return "CIB"
    if c == "NEW":
        return "New"
    return None

class PurchaseOrderService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PurchaseOrdersRepo(db)

    # -----------------------------
    # 1.1 Create PO
    # -----------------------------
    def create_po(self, payload):
        # Basic numeric validation (non-negative money fields)
        for fld in ("subtotal", "tax", "shipping", "fees", "discounts"):
            v = getattr(payload, fld, 0) or 0
            if v < 0:
                raise AppError(f"Invalid {fld}: must be >= 0", 400)

        # Validate source and get its code
        source_code = self.repo.get_source_code(payload.source_id)

        # Try insert with a simple 1-retry strategy to handle race on unique index
        for attempt in (1, 2):
            seq = self.repo.next_seq_for_source(payload.source_id, source_code)
            po_number = f"{source_code}{seq:03d}"  # left-pad to 3 for display

            try:
                created = self.repo.insert_po_header(
                    po_number=po_number,
                    source_id=payload.source_id,
                    date_purchased=getattr(payload, "date_purchased", None),
                    payment_method_id=getattr(payload, "payment_method_id", None),
                    external_order_number=getattr(payload, "external_order_number", None),
                    subtotal=payload.subtotal or 0,
                    tax=payload.tax or 0,
                    shipping=payload.shipping or 0,
                    fees=payload.fees or 0,
                    discounts=payload.discounts or 0,
                    notes=getattr(payload, "notes", None),
                )
                self.db.commit()
                return {
                    "purchase_order_id": created["purchase_order_id"],
                    "po_number": created["po_number"],
                    "status": created["status"],     # 'open'
                    "is_locked": created["is_locked"],  # False
                    "total_cost": created["total_cost"],
                    "lines": [],
                }
            except IntegrityError:
                # Duplicate (source_id, po_number) — retry once by recalculating seq
                self.db.rollback()
                if attempt == 2:
                    raise AppError("Could not allocate a unique PO number, please retry", 409)

    
    def add_po_line(self, po_id: int, payload):
        if self.repo.get_po_is_locked(po_id):
            raise AppError("PO is locked; cannot add lines", 409)
        if payload.quantity_expected is None or payload.quantity_expected < 0:
            raise AppError("quantity_expected must be >= 0", 400)
        vctx = self.repo.get_variant_context(payload.variant_id)
        if payload.catalog_product_id != vctx["catalog_product_id"]:
            raise AppError("catalog_product_id does not match variant", 400)
        # require explicit basis now
        if payload.allocation_basis is None or payload.allocation_basis < 0:
            raise AppError("allocation_basis is required (>= 0)", 400)
        cost_method = payload.cost_assignment_method or "manual"  # or "by_market_value" if UI set it
        if cost_method not in ("by_market_value", "manual"):
            raise AppError("Invalid cost_assignment_method", 400)

        line = self.repo.insert_po_line_row(
            po_id=po_id,
            variant_id=vctx["variant_id"],
            catalog_product_id=vctx["catalog_product_id"],
            quantity_expected=payload.quantity_expected,
            allocation_basis=payload.allocation_basis,
            allocation_basis_source=(payload.allocation_basis_source or "other"),
            cost_assignment_method=cost_method,
            allocated_unit_cost=payload.allocated_unit_cost,
            notes=getattr(payload, "notes", None),
            attributes_json=None,
        )
        self.db.commit()
        return line
    def lock_po(self, po_id: int) -> dict:
        # Ensure PO exists and not already locked
        if self.repo.get_po_is_locked(po_id):
            raise AppError("PO is already locked", 409)

        # Validate manual lines have allocated_unit_cost
        if self.repo.any_manual_line_missing_cost(po_id):
            raise AppError("Manual lines must have allocated_unit_cost before locking", 400)

        # Run allocation stored procedure
        run_allocation_proc(self.db, po_id)

        # Mark locked
        header = self.repo.mark_po_locked(po_id)
        lines = self.repo.get_po_lines_summary(po_id)
        self.db.commit()
        return {**header, "lines": lines}

    def list_pos(self, *, limit: int, offset: int, status: str | None, source_id: int | None, is_locked: bool | None) -> dict:
        page = self.repo.list_pos(limit=limit, offset=offset, status=status, source_id=source_id, is_locked=is_locked)
        return {**page, "limit": limit, "offset": offset}

    def get_po(self, po_id: int) -> dict:
        header = self.repo.get_po_header(po_id)
        lines = self.repo.get_po_lines_summary(po_id)
        header["lines"] = lines
        return header

    def update_po(self, po_id: int, payload) -> dict:
        # Check if PO exists and is not locked
        if self.repo.get_po_is_locked(po_id):
            raise AppError("PO is locked; cannot update header", 409)
        
        # Basic numeric validation for any provided money fields
        for fld in ("subtotal", "tax", "shipping", "fees", "discounts"):
            v = getattr(payload, fld, None)
            if v is not None and v < 0:
                raise AppError(f"Invalid {fld}: must be >= 0", 400)
        
        # Update the header
        self.repo.update_po_header(po_id, payload)
        self.db.commit()
        
        # Return updated header with lines
        return self.get_po(po_id)

    def update_po_line(self, po_id: int, item_id: int, payload) -> dict:
        # Check if PO exists and is not locked
        if self.repo.get_po_is_locked(po_id):
            raise AppError("PO is locked; cannot update line items", 409)
        
        # Validate quantity if provided
        if hasattr(payload, 'quantity_expected') and payload.quantity_expected is not None:
            if payload.quantity_expected < 0:
                raise AppError("quantity_expected must be >= 0", 400)
        
        # Validate allocation basis if provided
        if hasattr(payload, 'allocation_basis') and payload.allocation_basis is not None:
            if payload.allocation_basis < 0:
                raise AppError("allocation_basis must be >= 0", 400)
        
        # Validate cost assignment method if provided
        if hasattr(payload, 'cost_assignment_method') and payload.cost_assignment_method is not None:
            if payload.cost_assignment_method not in ("by_market_value", "manual"):
                raise AppError("Invalid cost_assignment_method", 400)
        
        # Update the line item
        line = self.repo.update_po_line(po_id, item_id, payload)
        self.db.commit()
        return line

    def delete_po_line(self, po_id: int, item_id: int) -> None:
        # Check if PO exists and is not locked
        if self.repo.get_po_is_locked(po_id):
            raise AppError("PO is locked; cannot delete line items", 409)
        
        # Delete the line item
        self.repo.delete_po_line(po_id, item_id)
        self.db.commit()
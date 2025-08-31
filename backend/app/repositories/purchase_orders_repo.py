from datetime import date, datetime
from typing import Any, Optional, Dict, List
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.errors import AppError


class PurchaseOrdersRepo:
    def __init__(self, db: Session):
        self.db = db

    # ---------- helpers

    def get_source_code(self, source_id: int) -> str:
        row = self.db.execute(
            text("SELECT code FROM dbo.Sources WHERE source_id = :sid AND is_active = 1"),
            {"sid": source_id},
        ).fetchone()
        if not row:
            raise AppError(f"Invalid source_id={source_id}", 400)
        return row[0]

    def next_seq_for_source(self, source_id: int, source_code: str) -> int:
        """
        Finds the max integer tail of po_number for this source, then +1.
        Works with variable widths; we store as text and extract the numeric tail.
        """
        row = self.db.execute(
            text(
                """
                SELECT MAX(TRY_CONVERT(INT, SUBSTRING(po_number, LEN(:code)+1, 64)))
                FROM dbo.PurchaseOrders
                WHERE source_id = :sid AND po_number LIKE :like
                """
            ),
            {"sid": source_id, "code": source_code, "like": f"{source_code}%"},
        ).fetchone()
        current_max = row[0] or 0
        return current_max + 1

    # ---------- writes

    def insert_po_header(
        self,
        *,
        po_number: str,
        source_id: int,
        date_purchased: Optional[date],
        payment_method_id: Optional[int],
        external_order_number: Optional[str],
        subtotal: float,
        tax: float,
        shipping: float,
        fees: float,
        discounts: float,
        notes: Optional[str],
    ) -> dict[str, Any]:
        row = self.db.execute(
            text(
                """
                INSERT INTO dbo.PurchaseOrders
                    (po_number, source_id, date_purchased,
                     subtotal, tax, shipping, fees, discounts,
                     status, payment_method_id, external_order_number, notes,
                     created_at, updated_at, is_locked)
                OUTPUT inserted.purchase_order_id, inserted.po_number, inserted.status, inserted.is_locked,
                       inserted.total_cost
                VALUES
                    (:po_number, :source_id, :date_purchased,
                     :subtotal, :tax, :shipping, :fees, :discounts,
                     'open', :payment_method_id, :external_order_number, :notes,
                     SYSDATETIME(), SYSDATETIME(), 0)
                """
            ),
            {
                "po_number": po_number,
                "source_id": source_id,
                "date_purchased": date_purchased,
                "subtotal": subtotal,
                "tax": tax,
                "shipping": shipping,
                "fees": fees,
                "discounts": discounts,
                "payment_method_id": payment_method_id,
                "external_order_number": external_order_number,
                "notes": notes,
            },
        ).fetchone()

        return {
            "purchase_order_id": row[0],
            "po_number": row[1],
            "status": row[2],
            "is_locked": bool(row[3]),
            "total_cost": float(row[4]) if row[4] is not None else float(subtotal + tax + shipping + fees - discounts),
        }

    def get_po_is_locked(self, po_id: int) -> bool:
        row = self.db.execute(
            text("SELECT is_locked FROM dbo.PurchaseOrders WHERE purchase_order_id = :po"),
            {"po": po_id},
        ).fetchone()
        if not row:
            raise AppError(f"PO {po_id} not found", 404)
        return bool(row[0])

    def get_variant_context(self, variant_id: int) -> Dict:
        """
        Returns:
        {
            'variant_id', 'catalog_product_id',
            'product_title', 'category_name',
            'variant_type_code',
            'platform_short'  # null for consoles / non-games
        }
        """
        row = self.db.execute(
            text("""
                SELECT
                v.variant_id,
                v.catalog_product_id,
                cp.title AS product_title,
                c.name   AS category_name,
                vt.code  AS variant_type_code,
                p.short_name AS platform_short,
                p.video_game_manual_sensitive AS platform_manual_sensitive
                FROM dbo.ListingVariants v
                JOIN dbo.CatalogProducts cp ON cp.catalog_product_id = v.catalog_product_id
                JOIN dbo.Categories c ON c.category_id = cp.category_id
                JOIN dbo.VariantTypes vt ON vt.variant_type_id = v.variant_type_id
                LEFT JOIN dbo.CatalogProductGames g ON g.catalog_product_id = cp.catalog_product_id
                LEFT JOIN dbo.Platforms p ON p.platform_id = g.platform_id
                WHERE v.variant_id = :vid
            """),
            {"vid": variant_id},
        ).mappings().fetchone()
        if not row:
            raise AppError(f"Variant {variant_id} not found", 404)
        return dict(row)

    def update_variant_market_value(self, variant_id: int, value: Optional[float]) -> None:
        if value is None:
            return
        self.db.execute(
            text("""
                UPDATE dbo.ListingVariants
                SET current_market_value = :v, updated_at = SYSDATETIME()
                WHERE variant_id = :vid
            """),
            {"v": value, "vid": variant_id},
        )

    def insert_po_line_row(
        self,
        *,
        po_id: int,
        variant_id: int,
        catalog_product_id: int,
        quantity_expected: int,
        allocation_basis: float,
        allocation_basis_source: str,
        cost_assignment_method: str,
        allocated_unit_cost: Optional[float],
        notes: Optional[str],
        attributes_json: Optional[str] = None,
    ) -> Dict:
        row = self.db.execute(
            text("""
                INSERT INTO dbo.PurchaseOrderItems
                (purchase_order_id, variant_id, catalog_product_id,
                quantity_expected, quantity_received,
                allocation_basis, allocation_basis_source,
                cost_assignment_method, allocated_unit_cost,
                receive_status, attributes_json, notes,
                created_at, updated_at)
                OUTPUT
                inserted.purchase_order_item_id, inserted.purchase_order_id, inserted.variant_id,
                inserted.catalog_product_id, inserted.quantity_expected, inserted.quantity_received,
                inserted.allocation_basis, inserted.allocation_basis_source, inserted.cost_assignment_method,
                inserted.allocated_unit_cost, inserted.receive_status, inserted.updated_at
                VALUES
                (:po, :vid, :cpid,
                :qty, 0,
                :basis, :basis_src,
                :cost_method, :alloc_cost,
                'pending', :attrs, :notes,
                SYSDATETIME(), SYSDATETIME())
            """),
            {
                "po": po_id,
                "vid": variant_id,
                "cpid": catalog_product_id,
                "qty": quantity_expected,
                "basis": allocation_basis,
                "basis_src": allocation_basis_source,
                "cost_method": cost_assignment_method,
                "alloc_cost": allocated_unit_cost,
                "attrs": attributes_json,
                "notes": notes,
            },
        ).mappings().fetchone()

        return {
            "purchase_order_item_id": row["purchase_order_item_id"],
            "purchase_order_id": row["purchase_order_id"],
            "variant_id": row["variant_id"],
            "catalog_product_id": row["catalog_product_id"],
            "quantity_expected": row["quantity_expected"],
            "quantity_received": row["quantity_received"],
            "allocation_basis": float(row["allocation_basis"]),
            "allocation_basis_source": row["allocation_basis_source"],
            "cost_assignment_method": row["cost_assignment_method"],
            "allocated_unit_cost": float(row["allocated_unit_cost"]) if row["allocated_unit_cost"] is not None else None,
            "receive_status": row["receive_status"],
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }

    def any_manual_line_missing_cost(self, po_id: int) -> bool:
        row = self.db.execute(
            text("""
                SELECT COUNT(*)
                FROM dbo.PurchaseOrderItems
                WHERE purchase_order_id = :po
                AND cost_assignment_method = 'manual'
                AND allocated_unit_cost IS NULL
            """),
            {"po": po_id},
        ).fetchone()
        return (row[0] or 0) > 0

    def mark_po_locked(self, po_id: int) -> Dict[str, Any]:
        row = self.db.execute(
            text("""
                UPDATE dbo.PurchaseOrders
                SET is_locked = 1, updated_at = SYSDATETIME()
                OUTPUT inserted.purchase_order_id, inserted.po_number, inserted.status, inserted.is_locked
                WHERE purchase_order_id = :po
            """),
            {"po": po_id},
        ).fetchone()
        if not row:
            raise AppError(f"PO {po_id} not found", 404)
        return {
            "purchase_order_id": row[0],
            "po_number": row[1],
            "status": row[2],
            "is_locked": bool(row[3]),
        }

    # ---------- summarizers
    def get_po_lines_summary(self, po_id: int) -> List[Dict]:
        rows = self.db.execute(
            text("""
                SELECT 
                    poi.purchase_order_item_id, poi.purchase_order_id, poi.variant_id, poi.catalog_product_id,
                    poi.quantity_expected, poi.quantity_received,
                    poi.allocation_basis, poi.allocation_basis_source,
                    poi.cost_assignment_method, poi.allocated_unit_cost,
                    poi.receive_status, poi.updated_at,
                    cp.title AS product_title,
                    vt.code AS variant_type_code,
                    vt.display_name AS variant_display_name,
                    p.short_name AS platform_short_name
                FROM dbo.PurchaseOrderItems poi
                JOIN dbo.ListingVariants lv ON lv.variant_id = poi.variant_id
                JOIN dbo.CatalogProducts cp ON cp.catalog_product_id = poi.catalog_product_id
                JOIN dbo.VariantTypes vt ON vt.variant_type_id = lv.variant_type_id
                LEFT JOIN dbo.CatalogProductGames cpg ON cpg.catalog_product_id = cp.catalog_product_id
                LEFT JOIN dbo.Platforms p ON p.platform_id = cpg.platform_id
                WHERE poi.purchase_order_id = :po
                ORDER BY poi.purchase_order_item_id
            """),
            {"po": po_id},
        ).mappings().all()
        out = []
        for r in rows:
            line_data = {
                "purchase_order_item_id": r["purchase_order_item_id"],
                "purchase_order_id": r["purchase_order_id"],
                "variant_id": r["variant_id"],
                "catalog_product_id": r["catalog_product_id"],
                "quantity_expected": r["quantity_expected"],
                "quantity_received": r["quantity_received"],
                "allocation_basis": float(r["allocation_basis"]),
                "allocation_basis_source": r["allocation_basis_source"],
                "cost_assignment_method": r["cost_assignment_method"],
                "allocated_unit_cost": float(r["allocated_unit_cost"]) if r["allocated_unit_cost"] is not None else None,
                "receive_status": r["receive_status"],
                "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
                "product_title": r["product_title"],
                "variant_type_code": r["variant_type_code"],
                "variant_display_name": r["variant_display_name"],
                "platform_short_name": r["platform_short_name"],
            }
            out.append(line_data)
        return out

    def get_po_header(self, po_id: int) -> Dict[str, Any]:
        row = self.db.execute(
            text("""
                SELECT purchase_order_id, po_number, source_id, status, is_locked,
                    subtotal, tax, shipping, fees, discounts, total_cost,
                    payment_method_id, external_order_number, notes,
                    created_at, updated_at
                FROM dbo.PurchaseOrders
                WHERE purchase_order_id = :po
            """),
            {"po": po_id},
        ).mappings().fetchone()
        if not row:
            raise AppError(f"PO {po_id} not found", 404)
        d = dict(row)
        d["is_locked"] = bool(d["is_locked"])
        d["total_cost"] = float(d["total_cost"])
        return d

    # ---------- list POs (simple pagination + optional filters)
    def list_pos(self, *, limit: int, offset: int, status: Optional[str] = None, source_id: Optional[int] = None, is_locked: Optional[bool] = None) -> Dict[str, Any]:
        where = "WHERE 1=1"
        params: Dict[str, Any] = {"limit": limit, "offset": offset}
        if status:
            where += " AND status = :status"
            params["status"] = status
        if source_id:
            where += " AND source_id = :source_id"
            params["source_id"] = source_id
        if is_locked is not None:
            where += " AND is_locked = :is_locked"
            params["is_locked"] = 1 if is_locked else 0

        total = self.db.execute(
            text(f"SELECT COUNT(*) AS cnt FROM dbo.PurchaseOrders {where}"),
            params,
        ).fetchone()[0] or 0

        rows = self.db.execute(
            text(f"""
                SELECT purchase_order_id, po_number, source_id, status, is_locked,
                    subtotal, tax, shipping, fees, discounts, total_cost,
                    created_at
                FROM dbo.PurchaseOrders
                {where}
                ORDER BY purchase_order_id DESC
                OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
            """),
            params,
        ).mappings().all()

        items = []
        for r in rows:
            items.append({
                "purchase_order_id": r["purchase_order_id"],
                "po_number": r["po_number"],
                "source_id": r["source_id"],
                "status": r["status"],
                "is_locked": bool(r["is_locked"]),
                "subtotal": float(r["subtotal"]),
                "tax": float(r["tax"]),
                "shipping": float(r["shipping"]),
                "fees": float(r["fees"]),
                "discounts": float(r["discounts"]),
                "total_cost": float(r["total_cost"]),
                "created_at": r["created_at"],
            })
        return {"items": items, "total": total}

    # ---------- Update methods
    def update_po_header(self, po_id: int, payload) -> None:
        """Update PO header fields (only if PO is not locked)"""
        # Build dynamic update clause based on provided fields
        updates = []
        params = {"po_id": po_id}
        
        if hasattr(payload, 'date_purchased') and payload.date_purchased is not None:
            updates.append("date_purchased = :date_purchased")
            params["date_purchased"] = payload.date_purchased
            
        if hasattr(payload, 'payment_method_id') and payload.payment_method_id is not None:
            updates.append("payment_method_id = :payment_method_id")
            params["payment_method_id"] = payload.payment_method_id
            
        if hasattr(payload, 'external_order_number') and payload.external_order_number is not None:
            updates.append("external_order_number = :external_order_number")
            params["external_order_number"] = payload.external_order_number
            
        if hasattr(payload, 'subtotal') and payload.subtotal is not None:
            updates.append("subtotal = :subtotal")
            params["subtotal"] = payload.subtotal
            
        if hasattr(payload, 'tax') and payload.tax is not None:
            updates.append("tax = :tax")
            params["tax"] = payload.tax
            
        if hasattr(payload, 'shipping') and payload.shipping is not None:
            updates.append("shipping = :shipping")
            params["shipping"] = payload.shipping
            
        if hasattr(payload, 'fees') and payload.fees is not None:
            updates.append("fees = :fees")
            params["fees"] = payload.fees
            
        if hasattr(payload, 'discounts') and payload.discounts is not None:
            updates.append("discounts = :discounts")
            params["discounts"] = payload.discounts
            
        if hasattr(payload, 'notes') and payload.notes is not None:
            updates.append("notes = :notes")
            params["notes"] = payload.notes
            
        if not updates:
            return  # Nothing to update
            
        updates.append("updated_at = SYSDATETIME()")
        
        update_sql = f"""
            UPDATE dbo.PurchaseOrders 
            SET {', '.join(updates)}
            WHERE purchase_order_id = :po_id AND is_locked = 0
        """
        
        result = self.db.execute(text(update_sql), params)
        if result.rowcount == 0:
            # Check if PO exists or is locked
            row = self.db.execute(
                text("SELECT is_locked FROM dbo.PurchaseOrders WHERE purchase_order_id = :po_id"),
                {"po_id": po_id}
            ).fetchone()
            if not row:
                raise AppError(f"PO {po_id} not found", 404)
            if row[0]:
                raise AppError(f"PO {po_id} is locked; cannot update", 409)

    def update_po_line(self, po_id: int, item_id: int, payload) -> Dict:
        """Update PO line item fields (only if PO is not locked)"""
        # Build dynamic update clause based on provided fields
        updates = []
        params = {"po_id": po_id, "item_id": item_id}
        
        if hasattr(payload, 'quantity_expected') and payload.quantity_expected is not None:
            updates.append("quantity_expected = :quantity_expected")
            params["quantity_expected"] = payload.quantity_expected
            
        if hasattr(payload, 'allocation_basis') and payload.allocation_basis is not None:
            updates.append("allocation_basis = :allocation_basis")
            params["allocation_basis"] = payload.allocation_basis
            
        if hasattr(payload, 'allocation_basis_source') and payload.allocation_basis_source is not None:
            updates.append("allocation_basis_source = :allocation_basis_source")
            params["allocation_basis_source"] = payload.allocation_basis_source
            
        if hasattr(payload, 'cost_assignment_method') and payload.cost_assignment_method is not None:
            updates.append("cost_assignment_method = :cost_assignment_method")
            params["cost_assignment_method"] = payload.cost_assignment_method
            
        if hasattr(payload, 'allocated_unit_cost') and payload.allocated_unit_cost is not None:
            updates.append("allocated_unit_cost = :allocated_unit_cost")
            params["allocated_unit_cost"] = payload.allocated_unit_cost
            
        if hasattr(payload, 'notes') and payload.notes is not None:
            updates.append("notes = :notes")
            params["notes"] = payload.notes
            
        if not updates:
            # If nothing to update, still return the current line item
            return self.get_po_line_by_id(item_id)
            
        updates.append("updated_at = SYSDATETIME()")
        
        update_sql = f"""
            UPDATE dbo.PurchaseOrderItems 
            SET {', '.join(updates)}
            OUTPUT inserted.*
            WHERE purchase_order_item_id = :item_id 
              AND purchase_order_id = :po_id 
              AND purchase_order_id IN (
                  SELECT purchase_order_id FROM dbo.PurchaseOrders 
                  WHERE purchase_order_id = :po_id AND is_locked = 0
              )
        """
        
        row = self.db.execute(text(update_sql), params).mappings().fetchone()
        
        if not row:
            # Check if PO/line exists or is locked
            po_row = self.db.execute(
                text("SELECT is_locked FROM dbo.PurchaseOrders WHERE purchase_order_id = :po_id"),
                {"po_id": po_id}
            ).fetchone()
            if not po_row:
                raise AppError(f"PO {po_id} not found", 404)
            if po_row[0]:
                raise AppError(f"PO {po_id} is locked; cannot update line items", 409)
                
            line_row = self.db.execute(
                text("SELECT * FROM dbo.PurchaseOrderItems WHERE purchase_order_item_id = :item_id"),
                {"item_id": item_id}
            ).fetchone()
            if not line_row:
                raise AppError(f"Line item {item_id} not found", 404)
        
        return {
            "purchase_order_item_id": row["purchase_order_item_id"],
            "purchase_order_id": row["purchase_order_id"],
            "variant_id": row["variant_id"],
            "catalog_product_id": row["catalog_product_id"],
            "quantity_expected": row["quantity_expected"],
            "quantity_received": row["quantity_received"],
            "allocation_basis": float(row["allocation_basis"]),
            "allocation_basis_source": row["allocation_basis_source"],
            "cost_assignment_method": row["cost_assignment_method"],
            "allocated_unit_cost": float(row["allocated_unit_cost"]) if row["allocated_unit_cost"] else None,
            "receive_status": row["receive_status"],
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }
    
    def get_po_line_by_id(self, item_id: int) -> Dict:
        """Get a single PO line item by ID"""
        row = self.db.execute(
            text("""
                SELECT purchase_order_item_id, purchase_order_id, variant_id, catalog_product_id,
                       quantity_expected, quantity_received, allocation_basis, allocation_basis_source,
                       cost_assignment_method, allocated_unit_cost, receive_status, updated_at
                FROM dbo.PurchaseOrderItems
                WHERE purchase_order_item_id = :item_id
            """),
            {"item_id": item_id}
        ).mappings().fetchone()
        
        if not row:
            raise AppError(f"Line item {item_id} not found", 404)
        
        return {
            "purchase_order_item_id": row["purchase_order_item_id"],
            "purchase_order_id": row["purchase_order_id"],
            "variant_id": row["variant_id"],
            "catalog_product_id": row["catalog_product_id"],
            "quantity_expected": row["quantity_expected"],
            "quantity_received": row["quantity_received"],
            "allocation_basis": float(row["allocation_basis"]),
            "allocation_basis_source": row["allocation_basis_source"],
            "cost_assignment_method": row["cost_assignment_method"],
            "allocated_unit_cost": float(row["allocated_unit_cost"]) if row["allocated_unit_cost"] else None,
            "receive_status": row["receive_status"],
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }

    def delete_po_line(self, po_id: int, item_id: int) -> None:
        """Delete a PO line item (only if PO is not locked)"""
        delete_sql = """
            DELETE FROM dbo.PurchaseOrderItems 
            WHERE purchase_order_item_id = :item_id 
              AND purchase_order_id = :po_id 
              AND purchase_order_id IN (
                  SELECT purchase_order_id FROM dbo.PurchaseOrders 
                  WHERE purchase_order_id = :po_id AND is_locked = 0
              )
        """
        
        result = self.db.execute(text(delete_sql), {"item_id": item_id, "po_id": po_id})
        
        if result.rowcount == 0:
            # Check if PO/line exists or is locked
            po_row = self.db.execute(
                text("SELECT is_locked FROM dbo.PurchaseOrders WHERE purchase_order_id = :po_id"),
                {"po_id": po_id}
            ).fetchone()
            if not po_row:
                raise AppError(f"PO {po_id} not found", 404)
            if po_row[0]:
                raise AppError(f"PO {po_id} is locked; cannot delete line items", 409)
                
            line_row = self.db.execute(
                text("SELECT * FROM dbo.PurchaseOrderItems WHERE purchase_order_item_id = :item_id"),
                {"item_id": item_id}
            ).fetchone()
            if not line_row:
                raise AppError(f"Line item {item_id} not found", 404)
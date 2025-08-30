from __future__ import annotations
from typing import Any, Dict, List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.errors import AppError
from datetime import datetime

class ReceivingRepo:
    def __init__(self, db: Session):
        self.db = db

    # ----- PO header & lookups -----

    def get_po_header(self, po_id: int) -> Tuple[str, str, bool]:
        row = self.db.execute(
            text("""
                SELECT po_number, status, is_locked
                FROM dbo.PurchaseOrders
                WHERE purchase_order_id = :po
            """),
            {"po": po_id},
        ).fetchone()
        if not row:
            raise AppError(f"PO {po_id} not found", 404)
        return row[0], row[1], bool(row[2])

    def get_unknown_condition_grade_id(self) -> int:
        row = self.db.execute(
            text("SELECT condition_grade_id FROM dbo.ConditionGrades WHERE code = 'UNKNOWN'")
        ).fetchone()
        if not row:
            raise AppError("Condition grade 'UNKNOWN' not found (seed missing)", 500)
        return int(row[0])

    def get_po_item_context(self, purchase_order_item_id: int) -> Dict[str, Any]:
        row = self.db.execute(
            text("""
            SELECT
              poi.purchase_order_item_id,
              poi.purchase_order_id,
              poi.variant_id,
              poi.catalog_product_id,
              poi.quantity_expected,
              poi.quantity_received,
              poi.receive_status,
              poi.allocated_unit_cost,
              po.po_number
            FROM dbo.PurchaseOrderItems poi
            JOIN dbo.PurchaseOrders po ON po.purchase_order_id = poi.purchase_order_id
            WHERE poi.purchase_order_item_id = :poi
            """),
            {"poi": purchase_order_item_id},
        ).mappings().fetchone()
        if not row:
            raise AppError(f"PO line {purchase_order_item_id} not found", 404)
        return dict(row)

    # ----- Staging query (used by GET and for internal validations) -----

    def fetch_staging_rows(self, po_id: int, include_non_receivable: bool = False) -> List[Dict[str, Any]]:
        where_receivable = "" if include_non_receivable else "AND (poi.quantity_expected - poi.quantity_received) > 0"
        sql = f"""
            SELECT
              poi.purchase_order_item_id,
              poi.purchase_order_id,
              poi.variant_id,
              poi.catalog_product_id,
              poi.quantity_expected,
              poi.quantity_received,
              (poi.quantity_expected - poi.quantity_received) AS remaining,
              poi.receive_status,
              poi.allocation_basis,
              poi.allocation_basis_source,
              poi.allocated_unit_cost,

              po.po_number,
              cp.title AS product_title,
              cat.name AS category_name,
              p.short_name AS platform_short,
              vt.code AS variant_type_code,
              v.current_market_value,
              CAST(poi.updated_at AS DATETIME2(3)) AS updated_at
            FROM dbo.PurchaseOrderItems poi
            JOIN dbo.PurchaseOrders po ON po.purchase_order_id = poi.purchase_order_id
            JOIN dbo.ListingVariants v ON v.variant_id = poi.variant_id
            JOIN dbo.VariantTypes vt ON vt.variant_type_id = v.variant_type_id
            JOIN dbo.CatalogProducts cp ON cp.catalog_product_id = poi.catalog_product_id
            JOIN dbo.Categories cat ON cat.category_id = cp.category_id
            LEFT JOIN dbo.CatalogProductGames g ON g.catalog_product_id = cp.catalog_product_id
            LEFT JOIN dbo.Platforms p ON p.platform_id = g.platform_id
            WHERE poi.purchase_order_id = :po
            {where_receivable}
            ORDER BY poi.purchase_order_item_id
        """
        return [dict(r) for r in self.db.execute(text(sql), {"po": po_id}).mappings().all()]

    # ----- Inventory & events -----

    def seller_sku_exists(self, sku: str) -> bool:
        return bool(
            self.db.execute(text("SELECT 1 FROM dbo.InventoryItems WHERE seller_sku = :s"), {"s": sku}).fetchone()
        )

    def insert_inventory_item(
        self,
        purchase_order_item_id: int,
        variant_id: int,
        seller_sku: str,
        quantity: int,
        allocated_unit_cost: float,
        condition_grade_id: int,
        status: str,
    ) -> int:
        row = self.db.execute(
            text(
                """
                INSERT INTO dbo.InventoryItems
                  (purchase_order_item_id, variant_id, seller_sku, quantity,
                   allocated_unit_cost, condition_grade_id, status, created_at, updated_at)
                OUTPUT inserted.inventory_item_id
                VALUES
                  (:poi, :variant_id, :sku, :qty,
                   :alloc_cost, :cond_id, :status, SYSDATETIME(), SYSDATETIME())
                """
            ),
            {
                "poi": purchase_order_item_id,
                "variant_id": variant_id,
                "sku": seller_sku,
                "qty": quantity,
                "alloc_cost": allocated_unit_cost,
                "cond_id": condition_grade_id,
                "status": status,
            },
        ).fetchone()
        return int(row[0])

    def insert_event(
        self,
        purchase_order_id: int,
        purchase_order_item_id: int,
        variant_id: int,
        event_type: str,
        quantity: int,
        notes: Optional[str] = None,
    ) -> int:
        row = self.db.execute(
            text(
                """
                INSERT INTO dbo.ReceivingEvents
                  (purchase_order_id, purchase_order_item_id, variant_id, event_type, quantity, notes, created_at)
                OUTPUT inserted.receiving_event_id
                VALUES
                  (:po, :poi, :variant_id, :etype, :qty, :notes, SYSDATETIME())
                """
            ),
            {"po": purchase_order_id, "poi": purchase_order_item_id, "variant_id": variant_id,
             "etype": event_type, "qty": quantity, "notes": notes},
        ).fetchone()
        return int(row[0])

    def update_poi_receive(self, purchase_order_item_id: int, qty_delta: int, new_status: str, expected_updated_at: datetime) -> None:
        res = self.db.execute(
            text(
                """
                UPDATE dbo.PurchaseOrderItems
                   SET quantity_received = quantity_received + :q,
                       receive_status = :status,
                       updated_at = SYSDATETIME()
                 WHERE purchase_order_item_id = :poi
                    AND CAST(updated_at AS DATETIME2(3)) = CAST(:expected AS DATETIME2(3))
                """
            ),
            {"q": qty_delta, "status": new_status, "poi": purchase_order_item_id, "expected": expected_updated_at},
        )
        if res.rowcount != 1:
            raise AppError("PO line changed by someone else; refresh and retry", 409, details={"purchase_order_item_id": purchase_order_item_id})

    # ----- PO status + progress -----

    def get_poi_totals(self, po_id: int) -> Dict[str, int]:
        row = self.db.execute(
            text(
                """
                SELECT
                  SUM(poi.quantity_expected) AS total_expected,
                  SUM(poi.quantity_received) AS total_received,
                  SUM(CASE WHEN poi.receive_status = 'short' THEN 1 ELSE 0 END) AS short_lines,
                  COUNT(1) AS total_lines
                FROM dbo.PurchaseOrderItems poi
                WHERE poi.purchase_order_id = :po
                """
            ),
            {"po": po_id},
        ).mappings().fetchone()
        return {
            "total_expected": int(row["total_expected"]) if row["total_expected"] is not None else 0,
            "total_received": int(row["total_received"]) if row["total_received"] is not None else 0,
            "short_lines": int(row["short_lines"]) if row["short_lines"] is not None else 0,
            "total_lines": int(row["total_lines"]) if row["total_lines"] is not None else 0,
        }

    def refresh_po_status(self, po_id: int) -> None:
        totals = self.get_poi_totals(po_id)
        if totals["total_expected"] == 0:
            return
        if totals["total_received"] >= totals["total_expected"]:
            new_status = "closed_with_exceptions" if totals["short_lines"] > 0 else "received"
        elif totals["total_received"] > 0:
            new_status = "partially_received"
        else:
            new_status = "open"
        self.db.execute(
            text("UPDATE dbo.PurchaseOrders SET status = :s, updated_at = SYSDATETIME() WHERE purchase_order_id = :po"),
            {"s": new_status, "po": po_id},
        )

    def get_progress(self, po_id: int) -> Dict[str, Any]:
        row = self.db.execute(text("SELECT * FROM dbo.vPO_Progress WHERE purchase_order_id = :po"), {"po": po_id}).mappings().fetchone()
        return dict(row) if row else {"purchase_order_id": po_id, "received_pct": 0}

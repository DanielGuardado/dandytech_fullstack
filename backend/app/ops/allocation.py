from sqlalchemy.orm import Session
from sqlalchemy import text

def run_allocation_proc(db: Session, po_id: int):
    db.execute(text("EXEC dbo.usp_AllocatePurchaseOrderCosts :po"), {"po": po_id})

Backend API Workflow — How we add new routes/endpoints

This documents the pattern we’ve been following in this project. It’s lightweight, explicit, and keeps logic layered: Router → Service → Repository, with SQL in repos, orchestration in services, and validation via Pydantic schemas. We always talk through the plan first, then implement in small, testable steps.

0) Before writing code — tiny planning checklist

Purpose & resource: What entity or action is this? (e.g., Receiving Staging Template, Inventory Item Patch)

HTTP shape: GET/POST/PATCH/DELETE; path (plural resources, hierarchy), query params, body.

Responses: success status (200/201/204) + body; error cases with status (400/404/409/422) and messages.

DB impact: new tables/cols/views? If yes → write a migration (see section 5). If no → re-use.

Transactions: where is the boundary? (usually service owns the transaction)

Concurrency (when needed): optimistic check with updated_at echo (used for POI updates).

Front-end data needs: return enough context for the keyboard-first grid (avoid N+1 calls).

1) Define schemas (Pydantic) — app/schemas/*.py

Create focused request/response models.

Request: strict validation, clear types (condecimal, enums), optional expected_updated_at if doing concurrency checks.

Response: the shape the UI needs (include denormalized context where helpful: titles, platform names, list prices, etc.).

Example

# app/schemas/inventory.py
from pydantic import BaseModel, Field, condecimal
from typing import Optional, Dict, Any

class InventoryItemPatch(BaseModel):
    seller_sku: Optional[str] = None
    list_price: Optional[condecimal(max_digits=10, decimal_places=2)] = None
    condition_grade_id: Optional[int] = None
    title_suffix: Optional[str] = None
    location: Optional[str] = None
    unit_attributes_json: Optional[Dict[str, Any]] = Field(None, description="profile-scoped attrs")

2) Repository (SQL only) — app/repositories/*.py

Raw SQL via text(...); no business rules, no transactions.

Return primitive dicts/rows.

Keep naming simple and explicit.

Example

# app/repositories/inventory_repo.py
from sqlalchemy import text

class InventoryRepository:
    def __init__(self, db):
        self.db = db

    def patch_item(self, inventory_item_id: int, fields: dict) -> int:
        allowed = {
            "seller_sku": "seller_sku",
            "list_price": "list_price",
            "condition_grade_id": "condition_grade_id",
            "title_suffix": "title_suffix",
            "location": "location",
        }
        sets, params = [], {"id": inventory_item_id}
        for k, col in allowed.items():
            if k in fields:
                sets.append(f"{col} = :{k}")
                params[k] = fields[k]
        if not sets:
            return 0
        sql = text(f"""
            UPDATE dbo.InventoryItems
               SET {', '.join(sets)}, updated_at = SYSDATETIME()
             WHERE inventory_item_id = :id
        """)
        res = self.db.execute(sql, params)
        return res.rowcount or 0

3) Service (business logic & transactions) — app/services/*.py

Own the transaction boundary (with Session.begin(): or explicit commit), avoid nested begin().

Validate cross-entity rules, call repos, invoke stored procs, log events, compose final response.

Raise AppError(message, http_status, details=...) for predictable error mapping.

Example

# app/services/inventory_service.py
from app.core.errors import AppError

class InventoryService:
    def __init__(self, db, repo):
        self.db = db
        self.repo = repo

    def patch_item(self, item_id: int, patch: dict) -> None:
        # Optional: trim strings, normalize empty->NULL here
        with self.db.begin():
            updated = self.repo.patch_item(item_id, patch)
            if updated != 1:
                raise AppError("Inventory item not found or not updated", 404)
        # Optionally: write InventoryEvents here if status/qty changes happen

4) Router (thin, declarative) — app/routers/*.py

Route signature = request schema in, response model out (when applicable).

Inject DB session + service via DI.

Map AppError → HTTPException once (shared exception handler) or per-route.

Use tags/summary/response_model for clean OpenAPI.

Example

# app/routers/inventory.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.inventory import InventoryItemPatch
from app.services.inventory_service import InventoryService

router = APIRouter(prefix="/inventory/items", tags=["inventory"])

@router.patch("/{item_id}", status_code=204, summary="Edit inventory item fields")
def patch_inventory_item(item_id: int, body: InventoryItemPatch, db: Session = Depends(get_db)):
    svc = InventoryService(db, InventoryRepository(db))
    svc.patch_item(item_id, body.dict(exclude_unset=True))
    return

5) Database changes (if needed) — migrations & seeds

New tables/columns/views → create a new file in db/migrations/ (timestamped name). Keep it forward-only, GO-separated batches allowed.

Seeds → idempotent scripts in db/seeds/ (use MERGE or IF NOT EXISTS).

Procs → place in db/procs/ with CREATE OR ALTER.

Apply with our runner:

python scripts/migrate.py         # applies migrations, then procs, then seeds
python scripts/migrate.py --no-seeds   # skip seeds if not needed

6) HTTP conventions we follow

Paths: plural nouns (/purchase-orders, /inventory/items). Hierarchy when needed (e.g., /purchase-orders/{po}/items).

GET: returns data; use query params for filters (po_id, paging), include rich context for the grid.

POST: create or domain actions (e.g., /receiving/commit). Return 201 with body for creates, 200 for actions.

PATCH: partial updates; dynamic SET clause (only what’s passed). Return 204 No Content.

DELETE: rarely used now (we archive instead of hard delete).

Status codes: 200/201/204 success; 400 validation; 404 not found; 409 conflict/concurrency; 422 body validation (FastAPI auto).

Errors: raise AppError in services; router/global handler converts to JSON {message, details?}.

7) Concurrency & transactions (our practice)

Service owns the transaction, repos are side-effecting but transaction-agnostic.

For sensitive updates (e.g., PO item receive counts) we use optimistic concurrency: require client to send updated_at echo; SQL checks WHERE CONVERT(VARCHAR(33), updated_at, 126) = :expected and returns 409 if mismatched.

Avoid nested Session.begin() to prevent `InvalidRequestErro
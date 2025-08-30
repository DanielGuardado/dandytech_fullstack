from __future__ import annotations
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.core.errors import AppError
from app.repositories.inventory_repo import InventoryRepo
from app.schemas.inventory_edit import PatchInventoryItemRequest
from app.services.inventory_service import InventoryService

class InventoryEditService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = InventoryRepo(db)
        self.detail = InventoryService(db)

    def patch(self, inventory_item_id: int, req: PatchInventoryItemRequest):
        updates: Dict[str, Any] = {}

        if req.seller_sku is not None:
            updates["seller_sku"] = req.seller_sku
        if req.list_price is not None:
            updates["list_price"] = float(req.list_price)
        with self.db.begin():
            
            if req.condition_grade_id is not None:
                # validate FK exists
                if not self.repo.condition_grade_exists(int(req.condition_grade_id)):
                    raise AppError(f"condition_grade_id {req.condition_grade_id} not found", 400)
                updates["condition_grade_id"] = int(req.condition_grade_id)
            if req.title_suffix is not None:
                updates["title_suffix"] = req.title_suffix
            if req.location is not None:
                updates["location"] = req.location

            if not updates:
                # nothing to change; return current detail
                return self.detail.get_item_detail(inventory_item_id, include_profile=True)

            self.repo.patch_item(inventory_item_id, updates)

        # return fresh detail for the row
        return self.detail.get_item_detail(inventory_item_id, include_profile=True)
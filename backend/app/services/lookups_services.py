import re
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.errors import AppError
from app.repositories.lookups_repo import LookupsRepo

ALLOWED_SOURCE_TYPES = {"Marketplace", "Retail", "PrivateParty", "Wholesale", "Other"}

class LookupsService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = LookupsRepo(db)

    # -------- GET /lookups
    def get_lookups(self) -> dict:
        return {
            "sources": self.repo.list_sources(),
            "payment_methods": self.repo.list_payment_methods(),
            "categories": self.repo.list_categories(),
            "variant_types": self.repo.list_variant_types(),
            "condition_grades": self.repo.list_condition_grades(),
            "platforms": self.repo.list_platforms(),
        }

    # -------- POST /lookups/sources
    def create_source(self, *, code: str, name: str, type_: str) -> dict:
        code = (code or "").strip()
        name = (name or "").strip()
        type_ = (type_ or "").strip()

        if not code or not name or not type_:
            raise AppError("Missing required fields", 400, {"code": "required", "name": "required", "type": "required"})

        # Reserve MAN for manual PO prefixes later
        if code.upper() == "MAN":
            raise AppError("Invalid source code", 400, {"code": "MAN not allowed"})

        # Keep codes simple: 2-20 alphanumeric (upper recommended but not enforced)
        if not re.fullmatch(r"[A-Za-z0-9]{2,20}", code):
            raise AppError("Invalid source code", 400, {"code": "Use 2-20 letters/digits (no spaces)"})

        if type_ not in ALLOWED_SOURCE_TYPES:
            raise AppError("Invalid source type", 400, {"type": f"Must be one of {sorted(ALLOWED_SOURCE_TYPES)}"})

        # Case-insensitive uniqueness
        if self.repo.source_exists_code(code):
            raise AppError("Source code already exists", 409, {"code": code})

        try:
            row = self.repo.insert_source(code=code.upper(), name=name, type_=type_)
            self.db.commit()
            return row
        except IntegrityError:
            self.db.rollback()
            raise AppError("Source code already exists", 409, {"code": code})

    # -------- POST /lookups/payment-methods
    def create_payment_method(self, *, code: str, display_name: str) -> dict:
        code = (code or "").strip()
        display_name = (display_name or "").strip()

        if not code or not display_name:
            raise AppError("Missing required fields", 400, {"code": "required", "display_name": "required"})

        # Your seed includes codes like 'eBayManaged' so do not force uppercase.
        if len(code) > 40:
            raise AppError("Invalid code", 400, {"code": "Max length 40"})

        if len(display_name) > 100:
            raise AppError("Invalid display_name", 400, {"display_name": "Max length 100"})

        # Case-insensitive uniqueness
        if self.repo.payment_method_exists_code(code):
            raise AppError("Payment method code already exists", 409, {"code": code})

        try:
            row = self.repo.insert_payment_method(code=code, display_name=display_name)
            self.db.commit()
            return row
        except IntegrityError:
            self.db.rollback()
            raise AppError("Payment method code already exists", 409, {"code": code})

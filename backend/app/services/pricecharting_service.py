from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.errors import AppError
from app.repositories.catalog_repo import CatalogRepo
from app.integrations.pricecharting_client import PriceChartingClient

BUCKET_BY_VT = {
    "LOOSE": "loose-price",
    "ORIGINAL_PACKAGING": "cib-price",  # aka CIB
    "NEW": "new-price",
}

ALLOWED_PC_CATEGORIES = {"Video Game", "Console"}

def convert_number_to_price(value):
    if isinstance(value, (int, float)):
        return value / 100
    return None

class PriceChartingService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CatalogRepo(db)
        self.pc = PriceChartingClient()

    
    # --- GET /catalog/{id}/pricecharting/search
    def search(self, catalog_product_id: int, q: Optional[str]) -> Dict:
        ctx = self.repo.get_product_context(catalog_product_id)
        if ctx["category_name"] not in ALLOWED_PC_CATEGORIES:
            raise AppError("PriceCharting search is only available for Video Game / Console", 400)

        query_used = (q or f"{ctx['title']} {ctx.get('platform_short') or ''}").strip()
        results = []
        if ctx.get("upc"):
            resp = self.pc.get_pricecharting_product_by_upc(ctx["upc"])
            products = (resp or {}).get("products") or []
            results = products if isinstance(products, list) else []
            if results:
                query_used = ctx["upc"]
        if not ctx.get("upc") or not results:
            resp = self.pc.get_pricecharting_products_by_query(query_used)
            products = (resp or {}).get("products") or []
            results = products if isinstance(products, list) else []

        out = []
        for r in (results or []):
            if isinstance(r, dict):
                out.append({
                    "id": str(r.get("id") or ""),
                    "title": r.get("product-name") or "",
                    "platform": r.get("console-name") or "",
                })
        return {"query_used": query_used, "results": out}

    # --- POST /catalog/{id}/pricecharting/not-on-pc
    def not_on_pc(self, catalog_product_id: int) -> Dict:
        ctx = self.repo.get_product_context(catalog_product_id)
        if ctx["category_name"] not in ALLOWED_PC_CATEGORIES:
            raise AppError("not_on_pc is only applicable to Video Game / Console", 400)
        self.repo.set_not_on_pc(catalog_product_id, True)
        self.db.commit()
        return {"catalog_product_id": catalog_product_id, "pricecharting_id": None, "not_on_pc": True}

    # --- POST /catalog/{id}/pricecharting/link
    def link(self, catalog_product_id: int, pricecharting_id: str, create_variants: bool = True) -> Dict:
        ctx = self.repo.get_product_context(catalog_product_id)
        if ctx["category_name"] not in ALLOWED_PC_CATEGORIES:
            raise AppError("Linking is only available for Video Game / Console", 400)

        if not pricecharting_id or not pricecharting_id.strip():
            raise AppError("pricecharting_id is required", 400)

        # Save link
        try:
            self.repo.set_pricecharting_id(catalog_product_id, pricecharting_id.strip())
            # Pull bucket values
            values = {}
            resp = self.pc.get_pricecharting_product_by_id(pricecharting_id.strip())
            if not resp or not isinstance(resp, dict) or "products" not in resp or not isinstance(resp["products"], list) or len(resp["products"]) < 1:
                raise AppError("PriceCharting ID not found", 404)
            
            pc_product = resp["products"][0]
            for vt_code, bucket in BUCKET_BY_VT.items():
                try:
                    price = pc_product.get(bucket)
                    format_price = convert_number_to_price(price)
                    values[vt_code] = format_price

                    # if vt_code == "LOOSE":
                    #     loose_price = pc_product.get("loose-price")
                    #     format_price = convert_number_to_price(loose_price)
                    #     values[vt_code] = format_price
                    # elif vt_code == "ORIGINAL_PACKAGING":
                    #     cib_price = pc_product.get("cib-price")
                    #     format_price = convert_number_to_price(cib_price)
                    #     values[vt_code] = format_price
                    # elif vt_code == "NEW":
                    #     new_price = pc_product.get("new-price")
                    #     format_price = convert_number_to_price(new_price)
                    #     values[vt_code] = format_price
                except Exception:
                    values[vt_code] = None

            # Upsert variants (create if missing; update current_market_value including NULLs)
            linked_variants = []
            if create_variants:
                for vt_code in ("LOOSE", "ORIGINAL_PACKAGING", "NEW"):
                    v = self.repo.upsert_variant_and_value(
                        catalog_product_id=catalog_product_id,
                        vt_code=vt_code,
                        value=values.get(vt_code),
                    )
                    linked_variants.append(v)

            self.db.commit()
            return {
                "catalog_product_id": catalog_product_id,
                "pricecharting_id": pricecharting_id,
                "not_on_pc": False,
                "variants": linked_variants,
            }
        except IntegrityError as e:
            self.db.rollback()
            # Likely UX_CatalogProducts_PriceChartingId unique violation
            raise AppError("This PriceCharting ID is already linked to another product", 409)

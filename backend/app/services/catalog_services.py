from typing import Optional, Tuple, List, Dict
import re
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.errors import AppError
from app.repositories.catalog_repo import CatalogRepo
from app.services.pricecharting_service import PriceChartingService


# Common short platform tokens we’ll try first client-side and also server-side
PLATFORM_TOKENS = [
    "ps5", "ps4", "ps3", "ps2", "ps1", "ps vita", "vita",
    "xbox series x", "xbox series s", "series x", "series s", "xsx", "xss",
    "xbox one", "xb1", "xone",
    "xbox 360", "360",
    "switch", "nintendo switch",
    "wii u", "wii", "3ds", "ds", "gba", "gamecube", "gc"
]

def extract_platform_hint(q: str) -> Tuple[str, Optional[str]]:
    """Return (clean_text, platform_token|None) by removing a known platform token from q."""
    q_norm = " ".join(q.strip().split())
    if not q_norm:
        return "", None
    lower = q_norm.lower()
    for token in sorted(PLATFORM_TOKENS, key=len, reverse=True):
        if token in lower:
            # remove the token substring
            pattern = re.compile(re.escape(token), re.IGNORECASE)
            cleaned = pattern.sub(" ", lower)
            cleaned = " ".join(cleaned.split())
            return cleaned, token
    return q_norm, None


class CatalogService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CatalogRepo(db)
        self.pc_service = PriceChartingService(db)

    # ---------- GET /catalog/search
    def search(self, *, q: Optional[str], upc: Optional[str],
               category_id: Optional[int], platform_id: Optional[int],
               limit: int, offset: int) -> dict:
        q = (q or "").strip()
        upc = (upc or "").strip() or None

        # If no explicit platform, try to infer from q
        inferred_pid = None
        q_text = q
        if not platform_id and q:
            q_text, token = extract_platform_hint(q)
            if token:
                inferred_pid = self.repo.platform_id_from_token(token)

        final_platform_id = platform_id or inferred_pid

        total = self.repo.count_catalog(q_text=q_text, upc=upc, category_id=category_id, platform_id=final_platform_id)
        rows = self.repo.search_catalog_page(q_text=q_text, upc=upc, category_id=category_id,
                                             platform_id=final_platform_id, limit=limit, offset=offset)
        product_ids = [r["catalog_product_id"] for r in rows]
        
        # Check for stale products and refresh their market values
        stale_products = self.repo.get_stale_products_with_pc_id(product_ids)
        if stale_products:
            for stale_product in stale_products:
                self.pc_service.refresh_market_values(stale_product["catalog_product_id"])
            # Commit the price updates
            self.db.commit()
        
        # Get variants (potentially refreshed)
        variants_by_product = self.repo.variants_for_products(product_ids)

        items = []
        for r in rows:
            platform = None
            if r.get("platform_id"):
                platform = {
                    "platform_id": r["platform_id"],
                    "name": r.get("platform_name"),
                    "short_name": r.get("short_name"),
                }
            vlist = []
            for v in variants_by_product.get(r["catalog_product_id"], []):
                vlist.append({
                    "variant_id": v["variant_id"],
                    "variant_type_id": v["variant_type_id"],
                    "variant_type_code": v["variant_type_code"],
                    "display_name": v["display_name"],
                    "current_market_value": float(v["current_market_value"]) if v["current_market_value"] is not None else None,
                    "default_list_price": float(v["default_list_price"]) if v["default_list_price"] is not None else None,
                })
            items.append({
                "catalog_product_id": r["catalog_product_id"],
                "title": r["title"],
                "category_id": r["category_id"],
                "category_name": r["category_name"],
                "brand": r.get("brand"),
                "upc": r.get("upc"),
                "platform": platform,
                "variants": vlist,
            })

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    # ---------- POST /catalog/products
    def create_product(self, payload) -> dict:
        # Validate category and required children by category name
        category_name = self.repo.get_category_name(payload.category_id)
        
        # Handle brand - either use brand_id directly or find/create from brand string
        brand_id = None
        if hasattr(payload, 'brand_id') and payload.brand_id:
            brand_id = payload.brand_id
        elif hasattr(payload, 'brand') and payload.brand:
            brand_info = self.repo.find_or_create_brand(payload.brand.strip())
            brand_id = brand_info['brand_id']
        
        # Auto-populate brand from platform if not provided and this is a video game
        if not brand_id and category_name == "Video Game" and payload.game and payload.game.platform_id:
            platform_brand = self.repo.get_brand_by_platform(payload.game.platform_id)
            if platform_brand:
                brand_id = platform_brand['brand_id']

        # Unique UPC enforced by filtered unique index; we surface a friendly 409
        try:
            new_id = self.repo.insert_catalog_product(
                category_id=payload.category_id,
                title=payload.title.strip(),
                brand_id=brand_id,
                upc=(payload.upc or None),
                release_year=payload.release_year,
                attributes_json=payload.attributes_json,
            )
        except IntegrityError as e:
            self.db.rollback()
            # likely UPC conflict
            raise AppError("Catalog product conflict (possibly duplicate UPC)", 409)

        created_children: List[str] = []

        if category_name == "Video Game":
            if not payload.game or not payload.game.platform_id:
                raise AppError("Video Game requires game.platform_id", 400)
            # verify platform exists
            if not self.repo.platform_by_id(payload.game.platform_id):
                raise AppError(f"Invalid platform_id={payload.game.platform_id}", 400)
            self.repo.insert_game_child(
                catalog_product_id=new_id,
                platform_id=payload.game.platform_id,
            )
            created_children.append("CatalogProductGames")

        elif category_name == "Console":
            if payload.console:
                self.repo.insert_console_child(
                    catalog_product_id=new_id,
                    model_number=payload.console.model_number,
                    storage_capacity_gb=payload.console.storage_capacity_gb,
                    firmware_sensitive=bool(payload.console.firmware_sensitive),
                )
                created_children.append("CatalogProductConsoles")

        # Amiibo / Accessories / Funko Pop / Controller → no child required

        self.db.commit()
        return {
            "catalog_product_id": new_id,
            "category_id": payload.category_id,
            "title": payload.title,
            "upc": payload.upc,
            "created_children": created_children,
        }

    # ---------- POST /catalog/products/{id}/variants
    def create_variant(self, catalog_product_id: int, payload) -> dict:
        try:
            row = self.repo.insert_variant(
                catalog_product_id=catalog_product_id,
                variant_type_id=payload.variant_type_id,
                default_list_price=payload.default_list_price,
            )
            self.db.commit()
        except IntegrityError as e:
            self.db.rollback()
            # Likely violates UX_ListingVariants_ActiveCombo unique filtered index
            raise AppError("Variant already exists for this (catalog, variant_type, packaging)", 409)

        return {
            "variant_id": row["variant_id"],
            "catalog_product_id": row["catalog_product_id"],
            "variant_type_id": row["variant_type_id"],
            "variant_type_code": row.get("variant_type_code"),
            "current_market_value": float(row["current_market_value"]) if row["current_market_value"] is not None else None,
            "default_list_price": float(row["default_list_price"]) if row["default_list_price"] is not None else None,
            "is_active": bool(row["is_active"]),
        }
    
    # ---------- GET /brands
    def get_brands(self) -> dict:
        """Get all active brands"""
        brands = self.repo.get_all_brands()
        return {
            "items": brands,
            "total": len(brands)
        }

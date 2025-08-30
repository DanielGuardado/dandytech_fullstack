from typing import Optional, List, Dict
import json
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.errors import AppError
from app.repositories.catalog_repo import CatalogRepo
from app.integrations.pricecharting_client import PriceChartingClient

BUCKET_BY_VT = {
    "LOOSE": "loose-price",
    "CIB": "cib-price",  # aka CIB
    "NEW": "new-price",
}

ALLOWED_PC_CATEGORIES = {"Video Game", "Console"}

def convert_number_to_price(value):
    if isinstance(value, (int, float)):
        return value / 100
    return None

def normalize_pricecharting_console_name(console_name: str) -> str:
    """Normalize PriceCharting console names to match our platform conventions"""
    if not console_name:
        return console_name
    
    # Mapping of common PriceCharting console names to our preferred format
    console_mappings = {
        # PlayStation variants
        "playstation": "PlayStation",
        "playstation 2": "PlayStation 2", 
        "playstation 3": "PlayStation 3",
        "playstation 4": "PlayStation 4",
        "playstation 5": "PlayStation 5",
        "ps1": "PlayStation",
        "ps2": "PlayStation 2",
        "ps3": "PlayStation 3", 
        "ps4": "PlayStation 4",
        "ps5": "PlayStation 5",
        "psx": "PlayStation",
        
        # Xbox variants
        "xbox": "Xbox",
        "xbox 360": "Xbox 360",
        "xbox one": "Xbox One", 
        "xbox series x": "Xbox Series X",
        "xbox series s": "Xbox Series S",
        "xbox series x|s": "Xbox Series X",
        
        # Nintendo variants
        "nintendo switch": "Nintendo Switch",
        "switch": "Nintendo Switch",
        "nintendo 3ds": "Nintendo 3DS",
        "3ds": "Nintendo 3DS",
        "nintendo ds": "Nintendo DS",
        "ds": "Nintendo DS",
        "nintendo wii": "Nintendo Wii",
        "wii": "Nintendo Wii",
        "nintendo wii u": "Nintendo Wii U", 
        "wii u": "Nintendo Wii U",
        "nintendo gamecube": "Nintendo GameCube",
        "gamecube": "Nintendo GameCube",
        "gc": "Nintendo GameCube",
        "nintendo 64": "Nintendo 64",
        "n64": "Nintendo 64",
        "super nintendo": "Super Nintendo",
        "snes": "Super Nintendo",
        "nintendo entertainment system": "Nintendo Entertainment System",
        "nes": "Nintendo Entertainment System",
        
        # Handheld variants
        "game boy advance": "Game Boy Advance",
        "gba": "Game Boy Advance",
        "game boy color": "Game Boy Color", 
        "gbc": "Game Boy Color",
        "game boy": "Game Boy",
        "gb": "Game Boy",
        
        # Other variants
        "sega genesis": "Sega Genesis",
        "genesis": "Sega Genesis",
        "sega saturn": "Sega Saturn",
        "saturn": "Sega Saturn",
        "sega dreamcast": "Sega Dreamcast",
        "dreamcast": "Sega Dreamcast",
    }
    
    normalized = console_name.lower().strip()
    return console_mappings.get(normalized, console_name.title())

class PriceChartingService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CatalogRepo(db)
        self.pc = PriceChartingClient()

    
    # --- GET /catalog/{id}/pricecharting/search
    def search(self, catalog_product_id: int, q: Optional[str], platform: Optional[str] = None) -> Dict:
        ctx = self.repo.get_product_context(catalog_product_id)
        if ctx["category_name"] not in ALLOWED_PC_CATEGORIES:
            raise AppError("PriceCharting search is only available for Video Game / Console", 400)

        # Build search query with platform context
        title = ctx['title']
        # Prefer full platform name over short name for better PriceCharting results
        platform_hint = platform or ctx.get('platform_name') or ctx.get('platform_short') or ''
        
        if q:
            # Use provided query, optionally append platform if not already included
            query_used = q
            if platform_hint and platform_hint.lower() not in q.lower():
                query_used = f"{q} {platform_hint}"
        else:
            # Build query from title + platform
            query_used = f"{title} {platform_hint}".strip()

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

            # Extract and save PriceCharting metadata to the product
            self._extract_and_save_metadata(catalog_product_id, pc_product)

            # Upsert variants (create if missing; update current_market_value including NULLs)
            linked_variants = []
            if create_variants:
                for vt_code in ("LOOSE", "CIB", "NEW"):
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

    def _extract_and_save_metadata(self, catalog_product_id: int, pc_product: Dict) -> None:
        """Extract metadata from PriceCharting response and update the product"""
        # Extract title (always update)
        title = pc_product.get("product-name", "").strip()
        if not title:
            return  # Skip if no title
        
        # Handle platform correction for video games
        self._update_platform_if_needed(catalog_product_id, pc_product)
        
        # Extract UPC
        upc = pc_product.get("upc", "").strip() or None
        
        # Extract and parse release year from release-date
        release_year = None
        release_date = pc_product.get("release-date", "")
        if release_date:
            try:
                # Parse date like "2015-11-10" to get year
                parsed_date = datetime.strptime(release_date, "%Y-%m-%d")
                release_year = parsed_date.year
            except ValueError:
                pass  # Skip if date format is unexpected
        
        # Build attributes JSON with all relevant metadata
        attributes = {}
        
        # Add core identifiers
        if pc_product.get("asin"):
            attributes["asin"] = pc_product["asin"]
        if pc_product.get("epid"):
            attributes["epid"] = pc_product["epid"]
        
        # Add game metadata
        if pc_product.get("genre"):
            attributes["genre"] = pc_product["genre"]
        if pc_product.get("sales-volume"):
            attributes["sales_volume"] = pc_product["sales-volume"]
        
        # Add GameStop pricing (convert from cents to dollars)
        if pc_product.get("gamestop-price"):
            attributes["gamestop_price"] = convert_number_to_price(pc_product["gamestop-price"])
        if pc_product.get("gamestop-trade-price"):
            attributes["gamestop_trade_price"] = convert_number_to_price(pc_product["gamestop-trade-price"])
        
        # Add retail pricing data
        retail_prices = {}
        retail_fields = [
            ("retail-loose-buy", "loose_buy"),
            ("retail-loose-sell", "loose_sell"),
            ("retail-cib-buy", "cib_buy"), 
            ("retail-cib-sell", "cib_sell"),
            ("retail-new-buy", "new_buy"),
            ("retail-new-sell", "new_sell")
        ]
        
        for pc_field, attr_field in retail_fields:
            if pc_product.get(pc_field) is not None:
                retail_prices[attr_field] = convert_number_to_price(pc_product[pc_field])
        
        if retail_prices:
            attributes["retail_prices"] = retail_prices
        
        # Add other useful fields
        if pc_product.get("bgs-10-price"):
            attributes["bgs_10_price"] = convert_number_to_price(pc_product["bgs-10-price"])
        if pc_product.get("graded-price"):
            attributes["graded_price"] = convert_number_to_price(pc_product["graded-price"])
        if pc_product.get("box-only-price"):
            attributes["box_only_price"] = convert_number_to_price(pc_product["box-only-price"])
        
        # Handle JSON merging at application level since SQL Server doesn't support JSON_MERGE_PATCH
        merged_attributes_json = None
        if attributes:
            # Get existing attributes
            existing_attrs_json = self.repo.get_product_attributes_json(catalog_product_id)
            
            if existing_attrs_json:
                try:
                    # Parse existing attributes and merge with new ones
                    existing_attrs = json.loads(existing_attrs_json)
                    # New attributes override existing ones
                    merged_attrs = {**existing_attrs, **attributes}
                    merged_attributes_json = json.dumps(merged_attrs)
                except (json.JSONDecodeError, TypeError):
                    # If existing JSON is invalid, just use new attributes
                    merged_attributes_json = json.dumps(attributes)
            else:
                # No existing attributes, just use new ones
                merged_attributes_json = json.dumps(attributes)
        
        # Update the product with extracted metadata
        self.repo.update_product_from_pricecharting(
            catalog_product_id=catalog_product_id,
            title=title,
            upc=upc,
            release_year=release_year,
            attributes_json=merged_attributes_json
        )

    def _update_platform_if_needed(self, catalog_product_id: int, pc_product: Dict) -> None:
        """Update product platform if PriceCharting console differs from current platform"""
        console_name = pc_product.get("console-name", "").strip()
        if not console_name:
            return
        
        # Get current product context to check if it's a video game
        ctx = self.repo.get_product_context(catalog_product_id)
        if ctx["category_name"] != "Video Game":
            return  # Only update platforms for video games
        
        # Normalize the PriceCharting console name
        normalized_console = normalize_pricecharting_console_name(console_name)
        
        # Check if current platform matches the PriceCharting console
        current_platform_name = ctx.get("platform_name", "")
        current_platform_short = ctx.get("platform_short", "")
        
        # If current platform already matches, no need to update
        if (normalized_console.lower() in [current_platform_name.lower(), current_platform_short.lower()] or
            current_platform_name.lower() in normalized_console.lower() or
            current_platform_short.lower() in normalized_console.lower()):
            return
        
        # Try to find existing platform that matches the PriceCharting console
        platform = self.repo.find_platform_by_name(normalized_console)
        
        if not platform:
            # Create new platform if it doesn't exist
            # Generate short name from console name
            short_name = self._generate_short_name(normalized_console)
            platform = self.repo.create_platform(
                name=normalized_console,
                short_name=short_name,
                category_id=2  # Video Game category
            )
        
        # Update the game's platform
        self.repo.update_game_platform(catalog_product_id, platform["platform_id"])
    
    def _generate_short_name(self, platform_name: str) -> str:
        """Generate a short name for a platform"""
        short_mappings = {
            "PlayStation": "PS1",
            "PlayStation 2": "PS2", 
            "PlayStation 3": "PS3",
            "PlayStation 4": "PS4",
            "PlayStation 5": "PS5",
            "Xbox 360": "X360",
            "Xbox One": "XB1", 
            "Xbox Series X": "XSX",
            "Xbox Series S": "XSS",
            "Nintendo Switch": "Switch",
            "Nintendo 3DS": "3DS",
            "Nintendo DS": "DS",
            "Nintendo Wii": "Wii",
            "Nintendo Wii U": "Wii U",
            "Nintendo GameCube": "GC",
            "Nintendo 64": "N64",
            "Super Nintendo": "SNES",
            "Nintendo Entertainment System": "NES",
            "Game Boy Advance": "GBA",
            "Game Boy Color": "GBC",
            "Game Boy": "GB",
            "Sega Genesis": "Genesis",
            "Sega Saturn": "Saturn", 
            "Sega Dreamcast": "Dreamcast"
        }
        
        return short_mappings.get(platform_name, platform_name[:10])

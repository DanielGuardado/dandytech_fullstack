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


def normalize_search_text(text: str) -> str:
    """Remove punctuation and normalize spacing for better search matching"""
    # Remove common punctuation: periods, apostrophes, commas, colons, semicolons, exclamation marks, question marks
    # Keep hyphens and underscores as they're often meaningful in game titles
    normalized = re.sub(r"[.'\",;:!?]", "", text)
    # Normalize multiple spaces to single spaces
    normalized = re.sub(r'\s+', ' ', normalized)
    return normalized.strip()


def transform_search_query(q: str) -> List[str]:
    """Generate multiple search variations for better matching"""
    if not q or not q.strip():
        return [q]
    
    variations = [q]
    
    # 0. Add punctuation-normalized version
    normalized_q = normalize_search_text(q)
    if normalized_q != q and normalized_q:
        variations.append(normalized_q)
    
    # Also try adding common punctuation patterns for games like F.E.A.R.
    # If the query is all letters, try variations with periods between letters
    q_upper = q.upper()
    if len(q_upper) >= 2 and q_upper.isalpha():
        # For short queries like "FEAR", try "F.E.A.R." style
        if len(q_upper) <= 6:
            dotted_version = '.'.join(q_upper) + '.'
            variations.append(dotted_version)
    
    # Try adding apostrophes for possessives (e.g., "luigis mansion" -> "luigi's mansion")
    words = q.lower().split()
    for i, word in enumerate(words):
        if word.endswith('s') and len(word) > 2:
            # Try adding apostrophe before the 's' 
            possessive_word = word[:-1] + "'s"
            possessive_phrase = words.copy()
            possessive_phrase[i] = possessive_word
            title_version = ' '.join(possessive_phrase).title()
            lower_version = ' '.join(possessive_phrase)
            variations.append(title_version)
            variations.append(lower_version)
    
    # 1. Roman numeral conversions (bidirectional)
    ROMAN_MAP = {
        '2': 'II', '3': 'III', '4': 'IV', '5': 'V',
        '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X'
    }
    
    # Convert numbers to roman numerals
    for num, roman in ROMAN_MAP.items():
        if f' {num}' in q or q.endswith(f' {num}') or q == num:
            variations.append(re.sub(f'\\b{num}\\b', roman, q))
        # Also try on normalized version
        if normalized_q and (f' {num}' in normalized_q or normalized_q.endswith(f' {num}') or normalized_q == num):
            variations.append(re.sub(f'\\b{num}\\b', roman, normalized_q))
    
    # Convert roman numerals to numbers  
    q_upper = q.upper()
    normalized_q_upper = normalized_q.upper() if normalized_q else ""
    for num, roman in ROMAN_MAP.items():
        if f' {roman}' in q_upper or q_upper.endswith(f' {roman}') or q_upper == roman:
            variations.append(re.sub(f'\\b{roman}\\b', num, q, flags=re.IGNORECASE))
        # Also try on normalized version
        if normalized_q_upper and (f' {roman}' in normalized_q_upper or normalized_q_upper.endswith(f' {roman}') or normalized_q_upper == roman):
            variations.append(re.sub(f'\\b{roman}\\b', num, normalized_q, flags=re.IGNORECASE))
    
    # 2. Game abbreviation expansions
    GAME_ABBREVIATIONS = {
        'gta': 'grand theft auto',
        'cod': 'call of duty', 
        'ac': 'assassins creed',
        'bf': 'battlefield',
        'nfs': 'need for speed',
        'gow': 'god of war',
        'tlou': 'the last of us',
        'rdr': 'red dead',
        'mgs': 'metal gear solid',
        'ff': 'final fantasy',
        'gh': 'guitar hero',
        're': 'resident evil',
        'sf': 'street fighter',
        'mk': 'mortal kombat',
        'tes': 'the elder scrolls',
        'fo': 'fallout',
        'dmc': 'devil may cry'
    }
    
    # Try abbreviation expansion on both original and normalized queries
    for base_query in [q, normalized_q]:
        if not base_query:
            continue
        q_words = base_query.lower().split()
        for abbrev, full_name in GAME_ABBREVIATIONS.items():
            if abbrev in q_words:
                # Replace just the abbreviation word
                new_words = [full_name if word == abbrev else word for word in q_words]
                variations.append(' '.join(new_words))
    
    # Remove duplicates while preserving order (original query first)
    seen = set()
    unique_variations = []
    for variation in variations:
        if variation and variation not in seen:
            seen.add(variation)
            unique_variations.append(variation)
    
    return unique_variations


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

        # Generate search query variations for better matching
        search_queries = transform_search_query(q) if q else [q]
        
        # Collect results from all variations
        all_results = []
        seen_ids = set()
        remaining_limit = limit
        
        for query_variation in search_queries:
            if remaining_limit <= 0:
                break
                
            # If no explicit platform, try to infer from query variation
            inferred_pid = None
            q_text = query_variation
            if not platform_id and query_variation:
                q_text, token = extract_platform_hint(query_variation)
                if token:
                    inferred_pid = self.repo.platform_id_from_token(token)

            final_platform_id = platform_id or inferred_pid

            # Search with this variation
            rows = self.repo.search_catalog_page(q_text=q_text, upc=upc, category_id=category_id,
                                                 platform_id=final_platform_id, limit=remaining_limit, offset=offset)
            
            # Add unique results (prioritize results from original query)
            for row in rows:
                if row["catalog_product_id"] not in seen_ids:
                    seen_ids.add(row["catalog_product_id"])
                    all_results.append(row)
                    remaining_limit -= 1
                    if remaining_limit <= 0:
                        break

        # Use all_results instead of rows
        rows = all_results
        product_ids = [r["catalog_product_id"] for r in rows]
        
        # Calculate total count using original query for consistency
        original_q_text = q
        original_inferred_pid = None
        if not platform_id and q:
            original_q_text, token = extract_platform_hint(q)
            if token:
                original_inferred_pid = self.repo.platform_id_from_token(token)
        original_platform_id = platform_id or original_inferred_pid
        total = self.repo.count_catalog(q_text=original_q_text, upc=upc, category_id=category_id, platform_id=original_platform_id)
        
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
                    "platform_short": v.get("platform_short"),
                    "platform_manual_sensitive": v.get("platform_manual_sensitive"),
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

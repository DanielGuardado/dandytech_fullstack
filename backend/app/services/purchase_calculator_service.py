from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.errors import AppError
from app.repositories.purchase_calculator_repo import PurchaseCalculatorRepo
from app.repositories.purchase_orders_repo import PurchaseOrdersRepo
from app.repositories.catalog_repo import CatalogRepo
from app.services.pricecharting_service import PriceChartingService
from decimal import Decimal
import json

class PurchaseCalculatorService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PurchaseCalculatorRepo(db)
        self.po_repo = PurchaseOrdersRepo(db)
        self.catalog_repo = CatalogRepo(db)
        self.pc_service = PriceChartingService(db)

    # -------- Configuration Methods --------

    def get_config(self) -> Dict[str, Any]:
        """Get all configuration values as a dictionary"""
        configs = self.repo.get_all_config()
        return {config["config_key"]: config for config in configs}

    def update_config(self, config_updates: Dict[str, float]) -> Dict[str, Any]:
        """Update multiple configuration values"""
        # Validate all keys exist
        current_config = self.get_config()
        for key in config_updates:
            if key not in current_config:
                raise AppError(f"Unknown configuration key: {key}", 400)
        
        self.repo.update_configs_batch(config_updates)
        self.db.commit()
        return self.get_config()

    def update_platform_markup(self, platform_id: int, markup: float) -> Dict:
        """Update platform default markup"""
        if markup < 0:
            raise AppError("Markup must be >= 0", 400)
        
        result = self.repo.update_platform_markup(platform_id, markup)
        if not result:
            raise AppError("Platform not found", 404)
        
        self.db.commit()
        return result

    # -------- Session Management --------

    def create_session(self, session_name: Optional[str] = None, source_id: Optional[int] = None) -> Dict:
        """Create a new calculator session"""
        if source_id and not self._validate_source_exists(source_id):
            raise AppError("Invalid source_id", 400)
        
        session = self.repo.create_session(session_name, source_id)
        self.db.commit()
        return session

    def get_session(self, session_id: int) -> Dict:
        """Get session with items"""
        session = self.repo.get_session(session_id)
        if not session:
            raise AppError("Session not found", 404)
        
        items = self.repo.get_session_items(session_id)
        
        # Add detailed calculation breakdown to each item
        for item in items:
            if item.get("market_price") or item.get("override_price"):
                detailed_calcs = self._calculate_item_pricing(item)
                item.update({k: v for k, v in detailed_calcs.items() 
                           if k in ['sales_tax', 'final_value', 'base_variable_fee', 
                                   'discounted_variable_fee', 'transaction_fee', 'ad_fee', 
                                   'shipping_cost', 'supplies_cost', 'regular_cashback', 
                                   'shipping_cashback', 'total_cashback']})
        
        session["items"] = items
        return session

    def list_sessions(self, limit: int = 25, offset: int = 0, status: Optional[str] = None) -> Dict:
        """List calculator sessions"""
        return self.repo.list_sessions(limit=limit, offset=offset, status=status)

    def update_session(self, session_id: int, **updates) -> Dict:
        """Update session"""
        session = self.repo.get_session(session_id)
        if not session:
            raise AppError("Session not found", 404)
        
        if "source_id" in updates and updates["source_id"] and not self._validate_source_exists(updates["source_id"]):
            raise AppError("Invalid source_id", 400)
        
        if "status" in updates and updates["status"] not in ["draft", "finalized", "converted_to_po"]:
            raise AppError("Invalid status", 400)
        
        updated_session = self.repo.update_session(session_id, **updates)
        self.db.commit()
        return updated_session

    def delete_session(self, session_id: int) -> bool:
        """Delete session and all items"""
        session = self.repo.get_session(session_id)
        if not session:
            raise AppError("Session not found", 404)
        
        # Don't allow deletion of converted sessions
        if session["status"] == "converted_to_po":
            raise AppError("Cannot delete session that has been converted to PO", 409)
        
        success = self.repo.delete_session(session_id)
        self.db.commit()
        return success

    # -------- Item Management --------

    def add_item(self, session_id: int, item_data: Dict) -> Dict:
        """Add item to session with calculations"""
        # Debug logging
        print(f"DEBUG: Received item_data: {item_data}")
        
        session = self.repo.get_session(session_id)
        if not session:
            raise AppError("Session not found", 404)
        
        if session["status"] == "converted_to_po":
            raise AppError("Cannot modify session that has been converted to PO", 409)
        
        # Validate item data and get product context if needed
        validated_item = self._validate_and_enrich_item(item_data)
        print(f"DEBUG: Validated item: {validated_item}")
        
        # Perform calculations
        calculated_item = self._calculate_item_pricing(validated_item)
        print(f"DEBUG: Calculated item: {calculated_item}")
        
        # Extract database fields (exclude detailed calculation fields)
        db_fields = {k: v for k, v in calculated_item.items() 
                    if k not in ['sales_tax', 'final_value', 'base_variable_fee', 
                                'discounted_variable_fee', 'transaction_fee', 'ad_fee', 
                                'shipping_cost', 'supplies_cost', 'regular_cashback', 
                                'shipping_cashback', 'total_cashback']}
        
        # Add to database
        created_item = self.repo.add_item(session_id, db_fields)
        
        # Add detailed calculation fields back for response
        created_item.update({k: v for k, v in calculated_item.items() 
                           if k in ['sales_tax', 'final_value', 'base_variable_fee', 
                                   'discounted_variable_fee', 'transaction_fee', 'ad_fee', 
                                   'shipping_cost', 'supplies_cost', 'regular_cashback', 
                                   'shipping_cashback', 'total_cashback']})
        
        # Update session totals
        self._recalculate_session_totals(session_id)
        
        self.db.commit()
        return created_item

    def update_item(self, session_id: int, item_id: int, updates: Dict) -> Dict:
        """Update calculator item"""
        session = self.repo.get_session(session_id)
        if not session:
            raise AppError("Session not found", 404)
        
        if session["status"] == "converted_to_po":
            raise AppError("Cannot modify session that has been converted to PO", 409)
        
        item = self.repo.get_item(item_id)
        if not item or item["session_id"] != session_id:
            raise AppError("Item not found", 404)
        
        # Recalculate if pricing fields changed
        if any(key in updates for key in ["override_price", "markup_amount", "target_profit_percentage"]):
            # Get current item data and apply updates
            current_data = {**item, **updates}
            calculated_updates = self._calculate_item_pricing(current_data)
            updates.update(calculated_updates)
        
        updated_item = self.repo.update_item(item_id, updates)
        
        # Update session totals
        self._recalculate_session_totals(session_id)
        
        self.db.commit()
        return updated_item

    def delete_item(self, session_id: int, item_id: int) -> bool:
        """Delete calculator item"""
        session = self.repo.get_session(session_id)
        if not session:
            raise AppError("Session not found", 404)
        
        if session["status"] == "converted_to_po":
            raise AppError("Cannot modify session that has been converted to PO", 409)
        
        item = self.repo.get_item(item_id)
        if not item or item["session_id"] != session_id:
            raise AppError("Item not found", 404)
        
        success = self.repo.delete_item(item_id)
        
        if success:
            # Update session totals
            self._recalculate_session_totals(session_id)
        
        self.db.commit()
        return success

    def recalculate_session(self, session_id: int) -> Dict:
        """Recalculate all items in a session"""
        session = self.repo.get_session(session_id)
        if not session:
            raise AppError("Session not found", 404)
        
        items = self.repo.get_session_items(session_id)
        
        # Recalculate each item
        for item in items:
            calculated_item = self._calculate_item_pricing(item)
            self.repo.update_item(item["item_id"], calculated_item)
        
        # Update session totals
        self._recalculate_session_totals(session_id)
        
        self.db.commit()
        return self.get_session(session_id)

    # -------- Conversion to Purchase Order --------

    def convert_to_purchase_order(self, session_id: int, po_data: Dict) -> Dict:
        """Convert calculator session to purchase order"""
        session = self.repo.get_session(session_id)
        if not session:
            raise AppError("Session not found", 404)
        
        if session["status"] == "converted_to_po":
            raise AppError("Session has already been converted", 409)
        
        items = self.repo.get_session_items(session_id)
        if not items:
            raise AppError("Session has no items to convert", 400)
        
        # Create PO header
        po_create_data = {
            "source_id": session["source_id"] or 1,  # Default to first source if none
            "date_purchased": po_data.get("po_date_purchased"),
            "external_order_number": po_data.get("external_order_number"),
            "notes": po_data.get("notes"),
            "subtotal": session["total_purchase_price"] or 0,
            "tax": 0,
            "shipping": 0,
            "fees": 0,
            "discounts": 0
        }
        
        # Create PO through existing service
        from app.services.purchase_order_service import PurchaseOrderService
        po_service = PurchaseOrderService(self.db)
        
        # Create PO header
        po = po_service.create_po(type('obj', (object,), po_create_data)())
        po_id = po["purchase_order_id"]
        
        # Add items to PO
        items_converted = 0
        for item in items:
            # Determine allocation basis and method based on cost source
            if item["cost_source"] in ["pricecharting", "pricecharting_override"]:
                allocation_basis_source = "pricecharting"
                cost_assignment_method = "by_market_value"
                allocation_basis = item["final_base_price"]
                allocated_unit_cost = None
            else:
                allocation_basis_source = "other"
                cost_assignment_method = "manual"
                allocation_basis = item["calculated_purchase_price"]
                allocated_unit_cost = item["calculated_purchase_price"]
            
            # Create PO line item
            line_data = {
                "variant_id": item["variant_id"],
                "catalog_product_id": item["catalog_product_id"],
                "quantity_expected": item["quantity"],
                "allocation_basis": allocation_basis,
                "allocation_basis_source": allocation_basis_source,
                "cost_assignment_method": cost_assignment_method,
                "allocated_unit_cost": allocated_unit_cost,
                "notes": item["notes"]
            }
            
            if item["variant_id"] and item["catalog_product_id"]:
                po_service.add_po_line(po_id, type('obj', (object,), line_data)())
                items_converted += 1
        
        # Update session status
        self.repo.update_session(session_id, status="converted_to_po", purchase_order_id=po_id)
        
        self.db.commit()
        
        return {
            "purchase_order_id": po_id,
            "po_number": po["po_number"],
            "items_converted": items_converted,
            "session_id": session_id
        }

    # -------- Private Helper Methods --------

    def _validate_source_exists(self, source_id: int) -> bool:
        """Validate that source exists"""
        result = self.db.execute(
            text("SELECT 1 FROM dbo.Sources WHERE source_id = :id AND is_active = 1"),
            {"id": source_id}
        ).scalar()
        return bool(result)

    def _validate_and_enrich_item(self, item_data: Dict) -> Dict:
        """Validate and enrich item data with product context"""
        enriched = dict(item_data)
        print(f"DEBUG: enriched before context: {enriched}")
        
        # If we have catalog_product_id and variant_id, get product context
        if enriched.get("catalog_product_id") and enriched.get("variant_id"):
            try:
                ctx = self.catalog_repo.get_product_context(enriched["catalog_product_id"])
                variant_ctx = self.po_repo.get_variant_context(enriched["variant_id"])
                print(f"DEBUG: variant_ctx: {variant_ctx}")
                
                # Enrich with product data
                enriched["product_title"] = ctx.get("title", "")
                enriched["platform_id"] = ctx.get("platform_id")
                enriched["variant_type_code"] = variant_ctx.get("variant_type_code", "")
                
                print(f"DEBUG: enriched market_price before PC lookup: {enriched.get('market_price')}")
                
                # Get PriceCharting data if available and not already provided
                if ctx.get("pricecharting_id"):
                    enriched["pricecharting_id"] = ctx["pricecharting_id"]
                    print(f"DEBUG: Has pricecharting_id, variant current_market_value: {variant_ctx.get('current_market_value')}")
                    # DON'T overwrite user-provided market_price
                    print(f"DEBUG: enriched market_price after PC lookup: {enriched.get('market_price')}")
                else:
                    print("DEBUG: No pricecharting_id found")
                    
            except Exception as e:
                # If we can't get product context, continue with provided data
                print(f"DEBUG: Exception in context lookup: {e}")
                pass
        
        # Get platform markup if platform_id is available
        if enriched.get("platform_id") and not enriched.get("markup_amount"):
            platform_row = self.db.execute(
                text("SELECT default_markup FROM dbo.Platforms WHERE platform_id = :id"),
                {"id": enriched["platform_id"]}
            ).scalar()
            if platform_row:
                enriched["markup_amount"] = float(platform_row)
        
        print(f"DEBUG: enriched at end of validation: {enriched}")
        return enriched

    def _calculate_item_pricing(self, item_data: Dict) -> Dict:
        """Calculate all pricing fields for an item using eBay fee structure"""
        config = self.get_config()
        
        # Determine base price and source
        if item_data.get("override_price") is not None:
            base_price = item_data["override_price"]
            if item_data.get("market_price"):
                cost_source = "pricecharting_override"
            else:
                cost_source = "manual"
        elif item_data.get("market_price") is not None:
            base_price = item_data["market_price"]
            cost_source = "pricecharting"
        else:
            # No price available
            return {
                **item_data,
                "final_base_price": None,
                "cost_source": "manual",
                "estimated_sale_price": None,
                "sales_tax": None,
                "final_value": None,
                "base_variable_fee": None,
                "discounted_variable_fee": None,
                "transaction_fee": None,
                "ad_fee": None,
                "shipping_cost": None,
                "supplies_cost": None,
                "regular_cashback": None,
                "shipping_cashback": None,
                "total_cashback": None,
                "total_fees": None,
                "net_after_fees": None,
                "calculated_purchase_price": None
            }
        
        final_base_price = base_price
        markup_amount = item_data.get("markup_amount", 3.50)
        estimated_sale_price = final_base_price + markup_amount
        
        # Step 1: Calculate sales tax and final value (what buyer pays)
        sales_tax_rate = float(config["sales_tax_avg"]["config_value"]) / 100
        sales_tax = estimated_sale_price * sales_tax_rate
        final_value = estimated_sale_price + sales_tax
        
        # Determine if this is a game or console based on category or variant type
        is_console = self._is_console_item(item_data)
        
        # Get fee configuration (convert Decimals to floats)
        if is_console:
            variable_fee_rate = float(config["variable_fee_consoles"]["config_value"]) / 100
            shipping_cost = float(config["average_shipping_cost_consoles"]["config_value"])
        else:
            variable_fee_rate = float(config["variable_fee_games"]["config_value"]) / 100
            shipping_cost = float(config["average_shipping_cost"]["config_value"])
        
        # Supplies cost based on sale price threshold (not final value)
        supplies_cost = (float(config["shipping_supplies_cost_under_40"]["config_value"]) 
                        if estimated_sale_price <= 40 
                        else float(config["shipping_supplies_cost_over_40"]["config_value"]))
        
        # Step 2: Calculate variable fee with top seller discount
        base_variable_fee = final_value * variable_fee_rate
        top_seller_discount_rate = float(config["top_seller_discount"]["config_value"]) / 100
        discounted_variable_fee = base_variable_fee * (1 - top_seller_discount_rate)
        
        # Step 3: Transaction fee = discounted variable fee + flat fee
        flat_fee = float(config["flat_trx_fee"]["config_value"])
        transaction_fee = discounted_variable_fee + flat_fee
        
        # Step 4: Ad fee based on final value
        ad_fee_rate = float(config["ad_fee"]["config_value"]) / 100
        ad_fee = final_value * ad_fee_rate
        
        # Step 5: Total fees
        total_fees = transaction_fee + ad_fee + shipping_cost + supplies_cost
        
        # Step 6: Calculate cashback (money back to us)
        regular_cashback_rate = float(config["regular_cashback_rate"]["config_value"]) / 100
        shipping_cashback_rate = float(config["shipping_cashback_rate"]["config_value"]) / 100
        regular_cashback = estimated_sale_price * regular_cashback_rate
        shipping_cashback = shipping_cost * shipping_cashback_rate
        total_cashback = regular_cashback + shipping_cashback
        
        # Step 7: Net after fees (we collect tax but remit it, so it nets out)
        net_after_fees = estimated_sale_price - total_fees + total_cashback
        
        # Debug logging for calculation verification
        print(f"DEBUG CALC - Sale: ${estimated_sale_price:.2f}, Tax: ${sales_tax:.2f}, Final: ${final_value:.2f}")
        print(f"DEBUG CALC - Base Var: ${base_variable_fee:.2f}, Disc Var: ${discounted_variable_fee:.2f}, Trans: ${transaction_fee:.2f}")
        print(f"DEBUG CALC - Ad: ${ad_fee:.2f}, Ship: ${shipping_cost:.2f}, Supplies: ${supplies_cost:.2f}")
        print(f"DEBUG CALC - Total Fees: ${total_fees:.2f}, Cashback: ${total_cashback:.2f}, Net: ${net_after_fees:.2f}")
        
        # Step 8: Calculate purchase price based on target profit margin
        target_profit_percentage = item_data.get("target_profit_percentage", 25.0) / 100
        calculated_purchase_price = net_after_fees * (1 - target_profit_percentage)
        
        return {
            **item_data,
            "final_base_price": final_base_price,
            "cost_source": cost_source,
            "estimated_sale_price": estimated_sale_price,
            "sales_tax": sales_tax,
            "final_value": final_value,
            "base_variable_fee": base_variable_fee,
            "discounted_variable_fee": discounted_variable_fee,
            "transaction_fee": transaction_fee,
            "ad_fee": ad_fee,
            "shipping_cost": shipping_cost,
            "supplies_cost": supplies_cost,
            "regular_cashback": regular_cashback,
            "shipping_cashback": shipping_cashback,
            "total_cashback": total_cashback,
            "total_fees": total_fees,
            "net_after_fees": net_after_fees,
            "calculated_purchase_price": max(0, calculated_purchase_price)  # Don't go negative
        }

    def _is_console_item(self, item_data: Dict) -> bool:
        """Determine if item is a console (affects fee calculation)"""
        # Check if we have catalog product context
        if item_data.get("catalog_product_id"):
            try:
                ctx = self.catalog_repo.get_product_context(item_data["catalog_product_id"])
                return ctx.get("category_name") == "Console"
            except:
                pass
        
        # Fallback: check variant type code
        variant_code = item_data.get("variant_type_code", "").upper()
        console_variants = ["CONSOLE", "SYSTEM", "HARDWARE"]
        return any(cv in variant_code for cv in console_variants)

    def _recalculate_session_totals(self, session_id: int) -> None:
        """Recalculate and update session totals"""
        items = self.repo.get_session_items(session_id)
        
        total_items = len(items)
        total_quantity = sum(item["quantity"] for item in items)
        
        total_market_value = 0
        total_estimated_revenue = 0
        total_purchase_price = 0
        total_fees = 0
        
        for item in items:
            quantity = item["quantity"]
            
            if item["market_price"]:
                total_market_value += item["market_price"] * quantity
            
            if item["estimated_sale_price"]:
                total_estimated_revenue += item["estimated_sale_price"] * quantity
                
            if item["calculated_purchase_price"]:
                total_purchase_price += item["calculated_purchase_price"] * quantity
                
            if item["total_fees"]:
                total_fees += item["total_fees"] * quantity
        
        expected_profit = total_estimated_revenue - total_fees - total_purchase_price
        expected_profit_margin = (expected_profit / total_estimated_revenue * 100) if total_estimated_revenue > 0 else 0
        
        totals = {
            "total_items": total_items,
            "total_market_value": total_market_value if total_market_value > 0 else None,
            "total_estimated_revenue": total_estimated_revenue if total_estimated_revenue > 0 else None,
            "total_purchase_price": total_purchase_price if total_purchase_price > 0 else None,
            "expected_profit": expected_profit if expected_profit != 0 else None,
            "expected_profit_margin": expected_profit_margin if expected_profit_margin != 0 else None
        }
        
        self.repo.update_session_totals(session_id, totals)
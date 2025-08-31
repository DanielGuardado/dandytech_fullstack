from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime

class PurchaseCalculatorRepo:
    def __init__(self, db: Session):
        self.db = db

    # -------- Configuration Methods --------

    def get_all_config(self) -> List[Dict]:
        """Get all configuration values"""
        rows = self.db.execute(
            text("""
                SELECT config_key, config_value, config_type, description, updated_at
                FROM dbo.PurchaseCalculatorConfig
                ORDER BY config_key
            """)
        ).mappings().all()
        return [dict(r) for r in rows]

    def get_config_by_key(self, config_key: str) -> Optional[Dict]:
        """Get a single configuration value by key"""
        row = self.db.execute(
            text("""
                SELECT config_key, config_value, config_type, description, updated_at
                FROM dbo.PurchaseCalculatorConfig
                WHERE config_key = :key
            """),
            {"key": config_key}
        ).mappings().first()
        return dict(row) if row else None

    def update_config(self, config_key: str, config_value: float) -> Dict:
        """Update a single configuration value"""
        self.db.execute(
            text("""
                UPDATE dbo.PurchaseCalculatorConfig
                SET config_value = :value, updated_at = SYSDATETIME()
                WHERE config_key = :key
            """),
            {"key": config_key, "value": config_value}
        )
        return self.get_config_by_key(config_key)

    def update_configs_batch(self, config_updates: Dict[str, float]) -> List[Dict]:
        """Update multiple configuration values"""
        for key, value in config_updates.items():
            self.update_config(key, value)
        return self.get_all_config()

    def update_platform_markup(self, platform_id: int, markup: float) -> Dict:
        """Update platform default markup"""
        self.db.execute(
            text("""
                UPDATE dbo.Platforms
                SET default_markup = :markup
                WHERE platform_id = :platform_id
            """),
            {"platform_id": platform_id, "markup": markup}
        )
        
        # Return updated platform info
        row = self.db.execute(
            text("""
                SELECT platform_id, name, short_name, category_id, brand_id, default_markup
                FROM dbo.Platforms
                WHERE platform_id = :platform_id
            """),
            {"platform_id": platform_id}
        ).mappings().first()
        return dict(row) if row else None

    # -------- Session Methods --------

    def create_session(self, session_name: Optional[str] = None, source_id: Optional[int] = None) -> Dict:
        """Create a new calculator session"""
        result = self.db.execute(
            text("""
                INSERT INTO dbo.PurchaseCalculatorSessions (session_name, source_id)
                OUTPUT INSERTED.session_id, INSERTED.session_name, INSERTED.source_id,
                       INSERTED.total_items, INSERTED.total_market_value, INSERTED.total_estimated_revenue,
                       INSERTED.total_purchase_price, INSERTED.expected_profit, INSERTED.expected_profit_margin,
                       INSERTED.status, INSERTED.purchase_order_id, INSERTED.created_at, INSERTED.updated_at
                VALUES (:session_name, :source_id)
            """),
            {"session_name": session_name, "source_id": source_id}
        ).mappings().first()
        return dict(result)

    def get_session(self, session_id: int) -> Optional[Dict]:
        """Get session details"""
        row = self.db.execute(
            text("""
                SELECT s.session_id, s.session_name, s.source_id, s.total_items,
                       s.total_market_value, s.total_estimated_revenue, s.total_purchase_price,
                       s.expected_profit, s.expected_profit_margin, s.status, s.purchase_order_id,
                       s.created_at, s.updated_at, src.name as source_name
                FROM dbo.PurchaseCalculatorSessions s
                LEFT JOIN dbo.Sources src ON s.source_id = src.source_id
                WHERE s.session_id = :session_id
            """),
            {"session_id": session_id}
        ).mappings().first()
        return dict(row) if row else None

    def list_sessions(self, limit: int = 25, offset: int = 0, status: Optional[str] = None) -> Dict:
        """List calculator sessions with pagination"""
        where_clause = ""
        params = {"limit": limit, "offset": offset}
        
        if status:
            where_clause = "WHERE s.status = :status"
            params["status"] = status

        # Get total count
        count_query = f"""
            SELECT COUNT(*)
            FROM dbo.PurchaseCalculatorSessions s
            {where_clause}
        """
        total = self.db.execute(text(count_query), params).scalar()

        # Get paginated results
        data_query = f"""
            SELECT s.session_id, s.session_name, s.source_id, s.total_items,
                   s.total_market_value, s.total_estimated_revenue, s.total_purchase_price,
                   s.expected_profit, s.expected_profit_margin, s.status, s.purchase_order_id,
                   s.created_at, s.updated_at, src.name as source_name
            FROM dbo.PurchaseCalculatorSessions s
            LEFT JOIN dbo.Sources src ON s.source_id = src.source_id
            {where_clause}
            ORDER BY s.updated_at DESC
            OFFSET :offset ROWS
            FETCH NEXT :limit ROWS ONLY
        """
        
        rows = self.db.execute(text(data_query), params).mappings().all()
        return {
            "items": [dict(r) for r in rows],
            "total": total
        }

    def update_session(self, session_id: int, **updates) -> Optional[Dict]:
        """Update session details"""
        set_clauses = []
        params = {"session_id": session_id}
        
        for key, value in updates.items():
            if key in ["session_name", "source_id", "status"]:
                set_clauses.append(f"{key} = :{key}")
                params[key] = value
        
        if not set_clauses:
            return self.get_session(session_id)
        
        set_clauses.append("updated_at = SYSDATETIME()")
        
        self.db.execute(
            text(f"""
                UPDATE dbo.PurchaseCalculatorSessions
                SET {', '.join(set_clauses)}
                WHERE session_id = :session_id
            """),
            params
        )
        
        return self.get_session(session_id)

    def update_session_totals(self, session_id: int, totals: Dict) -> None:
        """Update calculated session totals"""
        self.db.execute(
            text("""
                UPDATE dbo.PurchaseCalculatorSessions
                SET total_items = :total_items,
                    total_market_value = :total_market_value,
                    total_estimated_revenue = :total_estimated_revenue,
                    total_purchase_price = :total_purchase_price,
                    expected_profit = :expected_profit,
                    expected_profit_margin = :expected_profit_margin,
                    updated_at = SYSDATETIME()
                WHERE session_id = :session_id
            """),
            {
                "session_id": session_id,
                "total_items": totals.get("total_items", 0),
                "total_market_value": totals.get("total_market_value"),
                "total_estimated_revenue": totals.get("total_estimated_revenue"),
                "total_purchase_price": totals.get("total_purchase_price"),
                "expected_profit": totals.get("expected_profit"),
                "expected_profit_margin": totals.get("expected_profit_margin")
            }
        )

    def delete_session(self, session_id: int) -> bool:
        """Delete a calculator session and all its items"""
        result = self.db.execute(
            text("""
                DELETE FROM dbo.PurchaseCalculatorSessions
                WHERE session_id = :session_id
            """),
            {"session_id": session_id}
        )
        return result.rowcount > 0

    # -------- Item Methods --------

    def add_item(self, session_id: int, item_data: Dict) -> Dict:
        """Add item to calculator session"""
        # Prepare parameters, ensuring all required fields have values
        # Note: platform_id removed - platform info comes from CatalogProductGames JOIN
        params = {
            "session_id": session_id,
            "catalog_product_id": item_data.get("catalog_product_id"),
            "variant_id": item_data.get("variant_id"),
            "product_title": item_data.get("product_title", ""),
            "variant_type_code": item_data.get("variant_type_code", ""),
            "pricecharting_id": item_data.get("pricecharting_id"),
            "market_price": item_data.get("market_price"),
            "override_price": item_data.get("override_price"),
            "final_base_price": item_data.get("final_base_price"),
            "cost_source": item_data.get("cost_source", "manual"),
            "markup_amount": item_data.get("markup_amount"),
            "estimated_sale_price": item_data.get("estimated_sale_price"),
            "total_fees": item_data.get("total_fees"),
            "net_after_fees": item_data.get("net_after_fees"),
            "target_profit_percentage": item_data.get("target_profit_percentage", 25.0),
            "calculated_purchase_price": item_data.get("calculated_purchase_price"),
            "quantity": item_data.get("quantity", 1),
            "notes": item_data.get("notes"),
            # Detailed calculation fields
            "sales_tax": item_data.get("sales_tax"),
            "final_value": item_data.get("final_value"),
            "base_variable_fee": item_data.get("base_variable_fee"),
            "discounted_variable_fee": item_data.get("discounted_variable_fee"),
            "transaction_fee": item_data.get("transaction_fee"),
            "ad_fee": item_data.get("ad_fee"),
            "shipping_cost": item_data.get("shipping_cost"),
            "supplies_cost": item_data.get("supplies_cost"),
            "regular_cashback": item_data.get("regular_cashback"),
            "shipping_cashback": item_data.get("shipping_cashback"),
            "total_cashback": item_data.get("total_cashback")
        }
        
        result = self.db.execute(
            text("""
                INSERT INTO dbo.PurchaseCalculatorItems (
                    session_id, catalog_product_id, variant_id, product_title,
                    variant_type_code, pricecharting_id, market_price, override_price,
                    final_base_price, cost_source, markup_amount, estimated_sale_price,
                    total_fees, net_after_fees, target_profit_percentage, calculated_purchase_price,
                    quantity, notes,
                    sales_tax, final_value, base_variable_fee, discounted_variable_fee,
                    transaction_fee, ad_fee, shipping_cost, supplies_cost,
                    regular_cashback, shipping_cashback, total_cashback
                )
                OUTPUT INSERTED.item_id, INSERTED.session_id, INSERTED.catalog_product_id,
                       INSERTED.variant_id, INSERTED.product_title,
                       INSERTED.variant_type_code, INSERTED.pricecharting_id, INSERTED.market_price,
                       INSERTED.override_price, INSERTED.final_base_price, INSERTED.cost_source,
                       INSERTED.markup_amount, INSERTED.estimated_sale_price, INSERTED.total_fees,
                       INSERTED.net_after_fees, INSERTED.target_profit_percentage,
                       INSERTED.calculated_purchase_price, INSERTED.quantity, INSERTED.notes,
                       INSERTED.created_at, INSERTED.sales_tax, INSERTED.final_value,
                       INSERTED.base_variable_fee, INSERTED.discounted_variable_fee,
                       INSERTED.transaction_fee, INSERTED.ad_fee, INSERTED.shipping_cost,
                       INSERTED.supplies_cost, INSERTED.regular_cashback, INSERTED.shipping_cashback,
                       INSERTED.total_cashback
                VALUES (
                    :session_id, :catalog_product_id, :variant_id, :product_title,
                    :variant_type_code, :pricecharting_id, :market_price, :override_price,
                    :final_base_price, :cost_source, :markup_amount, :estimated_sale_price,
                    :total_fees, :net_after_fees, :target_profit_percentage, :calculated_purchase_price,
                    :quantity, :notes,
                    :sales_tax, :final_value, :base_variable_fee, :discounted_variable_fee,
                    :transaction_fee, :ad_fee, :shipping_cost, :supplies_cost,
                    :regular_cashback, :shipping_cashback, :total_cashback
                )
            """),
            params
        ).mappings().first()
        return dict(result)

    def get_session_items(self, session_id: int) -> List[Dict]:
        """Get all items for a session with platform details from CatalogProductGames JOIN"""
        rows = self.db.execute(
            text("""
                SELECT i.item_id, i.session_id, i.catalog_product_id, i.variant_id,
                       i.product_title, i.variant_type_code, i.pricecharting_id, i.market_price,
                       i.override_price, i.final_base_price, i.cost_source, i.markup_amount,
                       i.estimated_sale_price, i.total_fees, i.net_after_fees,
                       i.target_profit_percentage, i.calculated_purchase_price, i.quantity,
                       i.notes, i.created_at,
                       p.name as platform_name, 
                       p.short_name as platform_short_name,
                       i.sales_tax, i.final_value, i.base_variable_fee, i.discounted_variable_fee,
                       i.transaction_fee, i.ad_fee, i.shipping_cost, i.supplies_cost,
                       i.regular_cashback, i.shipping_cashback, i.total_cashback
                FROM dbo.PurchaseCalculatorItems i
                LEFT JOIN dbo.CatalogProductGames cpg ON cpg.catalog_product_id = i.catalog_product_id
                LEFT JOIN dbo.Platforms p ON p.platform_id = cpg.platform_id
                WHERE i.session_id = :session_id
                ORDER BY i.created_at ASC
            """),
            {"session_id": session_id}
        ).mappings().all()
        return [dict(r) for r in rows]

    def update_item(self, item_id: int, updates: Dict) -> Optional[Dict]:
        """Update calculator item"""
        set_clauses = []
        params = {"item_id": item_id}
        
        allowed_fields = [
            "override_price", "final_base_price", "cost_source", "markup_amount",
            "estimated_sale_price", "total_fees", "net_after_fees",
            "target_profit_percentage", "calculated_purchase_price", "quantity", "notes",
            # Detailed calculation fields
            "sales_tax", "final_value", "base_variable_fee", "discounted_variable_fee",
            "transaction_fee", "ad_fee", "shipping_cost", "supplies_cost",
            "regular_cashback", "shipping_cashback", "total_cashback"
        ]
        
        for key, value in updates.items():
            if key in allowed_fields:
                set_clauses.append(f"{key} = :{key}")
                params[key] = value
        
        if not set_clauses:
            return self.get_item(item_id)
        
        self.db.execute(
            text(f"""
                UPDATE dbo.PurchaseCalculatorItems
                SET {', '.join(set_clauses)}
                WHERE item_id = :item_id
            """),
            params
        )
        
        return self.get_item(item_id)

    def get_item(self, item_id: int) -> Optional[Dict]:
        """Get single calculator item with platform details from CatalogProductGames JOIN"""
        row = self.db.execute(
            text("""
                SELECT i.item_id, i.session_id, i.catalog_product_id, i.variant_id,
                       i.product_title, i.variant_type_code, i.pricecharting_id, i.market_price,
                       i.override_price, i.final_base_price, i.cost_source, i.markup_amount,
                       i.estimated_sale_price, i.total_fees, i.net_after_fees,
                       i.target_profit_percentage, i.calculated_purchase_price, i.quantity,
                       i.notes, i.created_at,
                       p.name as platform_name, 
                       p.short_name as platform_short_name,
                       i.sales_tax, i.final_value, i.base_variable_fee, i.discounted_variable_fee,
                       i.transaction_fee, i.ad_fee, i.shipping_cost, i.supplies_cost,
                       i.regular_cashback, i.shipping_cashback, i.total_cashback
                FROM dbo.PurchaseCalculatorItems i
                LEFT JOIN dbo.CatalogProductGames cpg ON cpg.catalog_product_id = i.catalog_product_id
                LEFT JOIN dbo.Platforms p ON p.platform_id = cpg.platform_id
                WHERE i.item_id = :item_id
            """),
            {"item_id": item_id}
        ).mappings().first()
        return dict(row) if row else None

    def delete_item(self, item_id: int) -> bool:
        """Delete calculator item"""
        result = self.db.execute(
            text("""
                DELETE FROM dbo.PurchaseCalculatorItems
                WHERE item_id = :item_id
            """),
            {"item_id": item_id}
        )
        return result.rowcount > 0

    def get_session_id_for_item(self, item_id: int) -> Optional[int]:
        """Get session_id for an item"""
        result = self.db.execute(
            text("""
                SELECT session_id
                FROM dbo.PurchaseCalculatorItems
                WHERE item_id = :item_id
            """),
            {"item_id": item_id}
        ).scalar()
        return result
-- Purchase Calculator Feature Migration
-- Adds tables and schema changes to support purchase price calculator functionality

-- Add default_markup column to Platforms table
ALTER TABLE dbo.Platforms 
ADD default_markup DECIMAL(10,2) NULL DEFAULT 3.50;
GO

-- Create PurchaseCalculatorConfig table for system-wide configuration
CREATE TABLE dbo.PurchaseCalculatorConfig (
  config_key NVARCHAR(50) NOT NULL PRIMARY KEY,
  config_value DECIMAL(10,4) NOT NULL,
  config_type NVARCHAR(20) NOT NULL, -- 'percentage' or 'amount'
  description NVARCHAR(200) NULL,
  updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- Create PurchaseCalculatorSessions table for tracking calculator sessions
CREATE TABLE dbo.PurchaseCalculatorSessions (
  session_id INT IDENTITY(1,1) PRIMARY KEY,
  session_name NVARCHAR(200) NULL,
  source_id INT NULL,
  total_items INT NOT NULL DEFAULT 0,
  total_market_value DECIMAL(10,2) NULL,
  total_estimated_revenue DECIMAL(10,2) NULL,
  total_purchase_price DECIMAL(10,2) NULL,
  expected_profit DECIMAL(10,2) NULL,
  expected_profit_margin DECIMAL(5,2) NULL,
  status NVARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'finalized', 'converted_to_po'
  purchase_order_id INT NULL, -- Links to PO if converted
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT FK_PurchaseCalculatorSessions_Sources
    FOREIGN KEY (source_id) REFERENCES dbo.Sources(source_id),
  CONSTRAINT FK_PurchaseCalculatorSessions_PurchaseOrders
    FOREIGN KEY (purchase_order_id) REFERENCES dbo.PurchaseOrders(purchase_order_id)
);
GO

-- Create PurchaseCalculatorItems table for individual items in calculator sessions
CREATE TABLE dbo.PurchaseCalculatorItems (
  item_id INT IDENTITY(1,1) PRIMARY KEY,
  session_id INT NOT NULL,
  catalog_product_id INT NULL,
  variant_id INT NULL,
  platform_id INT NULL,
  product_title NVARCHAR(500) NULL,
  variant_type_code NVARCHAR(50) NULL,
  pricecharting_id NVARCHAR(100) NULL,
  
  -- Pricing inputs
  market_price DECIMAL(10,2) NULL, -- Original from PriceCharting
  override_price DECIMAL(10,2) NULL, -- Manual override (for PC items or non-PC items)
  final_base_price DECIMAL(10,2) NULL, -- The price actually used (override or market)
  cost_source NVARCHAR(50) NULL, -- 'pricecharting', 'manual', 'pricecharting_override'
  markup_amount DECIMAL(10,2) NULL, -- Platform default or override
  
  -- Calculated values
  estimated_sale_price DECIMAL(10,2) NULL,
  total_fees DECIMAL(10,2) NULL,
  net_after_fees DECIMAL(10,2) NULL,
  target_profit_percentage DECIMAL(5,2) NOT NULL DEFAULT 25.00,
  calculated_purchase_price DECIMAL(10,2) NULL,
  
  quantity INT NOT NULL DEFAULT 1,
  notes NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  
  CONSTRAINT FK_PurchaseCalculatorItems_Sessions
    FOREIGN KEY (session_id) REFERENCES dbo.PurchaseCalculatorSessions(session_id) ON DELETE CASCADE,
  CONSTRAINT FK_PurchaseCalculatorItems_CatalogProducts
    FOREIGN KEY (catalog_product_id) REFERENCES dbo.CatalogProducts(catalog_product_id),
  CONSTRAINT FK_PurchaseCalculatorItems_Variants
    FOREIGN KEY (variant_id) REFERENCES dbo.ListingVariants(variant_id),
  CONSTRAINT FK_PurchaseCalculatorItems_Platforms
    FOREIGN KEY (platform_id) REFERENCES dbo.Platforms(platform_id)
);
GO

-- Create index on session_id for efficient item lookups
CREATE INDEX IX_PurchaseCalculatorItems_SessionId ON dbo.PurchaseCalculatorItems(session_id);
GO

-- Create index on purchase_order_id for converted sessions
CREATE INDEX IX_PurchaseCalculatorSessions_PurchaseOrderId ON dbo.PurchaseCalculatorSessions(purchase_order_id);
GO

-- Seed initial configuration values
INSERT INTO dbo.PurchaseCalculatorConfig (config_key, config_value, config_type, description) VALUES
('sales_tax_avg', 5.09, 'percentage', 'Average sales tax percentage'),
('variable_fee_games', 12.70, 'percentage', 'Variable fee for games (eBay/marketplace)'),
('variable_fee_consoles', 7.35, 'percentage', 'Variable fee for consoles (eBay/marketplace)'),
('flat_trx_fee', 0.40, 'amount', 'Flat transaction fee per sale'),
('average_shipping_cost', 4.40, 'amount', 'Average shipping cost for games'),
('average_shipping_cost_consoles', 12.00, 'amount', 'Average shipping cost for consoles'),
('top_seller_discount', 10.00, 'percentage', 'Top seller discount percentage'),
('ad_fee', 3.30, 'percentage', 'Advertisement fee percentage'),
('shipping_supplies_cost_under_40', 0.15, 'amount', 'Shipping supplies cost for items under $40'),
('shipping_supplies_cost_over_40', 1.00, 'amount', 'Shipping supplies cost for items over $40'),
('average_shipping_added', 4.20, 'amount', 'Average shipping cost added to sale price'),
('shipping_cashback_rate', 3.00, 'percentage', 'Cashback rate on shipping'),
('regular_cashback_rate', 1.00, 'percentage', 'Regular cashback rate'),
('local_sales_tax', 6.00, 'percentage', 'Local sales tax percentage');
GO

-- Update existing platforms with default markups
UPDATE dbo.Platforms SET default_markup = 3.50 WHERE default_markup IS NULL;
GO
-- Add detailed calculation fields to PurchaseCalculatorItems table
-- This allows storing complete calculation breakdowns for transparency and audit trail

-- Add new columns for detailed calculation breakdown
ALTER TABLE dbo.PurchaseCalculatorItems ADD
  -- Tax & Final Value
  sales_tax DECIMAL(10,2) NULL,
  final_value DECIMAL(10,2) NULL,
  
  -- Fee Breakdown
  base_variable_fee DECIMAL(10,2) NULL,
  discounted_variable_fee DECIMAL(10,2) NULL,
  transaction_fee DECIMAL(10,2) NULL,
  ad_fee DECIMAL(10,2) NULL,
  shipping_cost DECIMAL(10,2) NULL,
  supplies_cost DECIMAL(10,2) NULL,
  
  -- Cashback
  regular_cashback DECIMAL(10,2) NULL,
  shipping_cashback DECIMAL(10,2) NULL,
  total_cashback DECIMAL(10,2) NULL;
GO

-- Note: Existing rows will have NULL values for these new columns
-- They can be backfilled by recalculating using the current config values
-- or left as NULL since the calculation logic will handle missing values
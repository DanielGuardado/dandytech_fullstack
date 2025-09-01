-- Add purchase_price_before_tax column to track pre-tax purchase price calculation
-- This allows proper display of how purchase sales tax affects the final offer amount

-- Add purchase_price_before_tax column to PurchaseCalculatorItems table
ALTER TABLE dbo.PurchaseCalculatorItems 
ADD purchase_price_before_tax DECIMAL(10,2) NULL;
GO

-- Update the column with current calculated_purchase_price values as a baseline
-- (This ensures existing items have some data in the new column)
UPDATE dbo.PurchaseCalculatorItems 
SET purchase_price_before_tax = calculated_purchase_price 
WHERE calculated_purchase_price IS NOT NULL;
GO
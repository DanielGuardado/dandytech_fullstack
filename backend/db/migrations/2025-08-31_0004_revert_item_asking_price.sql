-- Revert: Remove asking_price from PurchaseCalculatorItems
-- This was incorrectly added at item level, should be at session level instead

-- Remove the column
ALTER TABLE dbo.PurchaseCalculatorItems
DROP COLUMN asking_price;
GO
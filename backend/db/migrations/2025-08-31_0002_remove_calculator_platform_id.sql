-- Remove platform_id from PurchaseCalculatorItems table
-- Platform information will now be retrieved through CatalogProductGames JOIN
-- This matches the pattern used by PurchaseOrderItems

-- Drop the foreign key constraint
ALTER TABLE dbo.PurchaseCalculatorItems
DROP CONSTRAINT FK_PurchaseCalculatorItems_Platforms;
GO

-- Drop the platform_id column
ALTER TABLE dbo.PurchaseCalculatorItems
DROP COLUMN platform_id;
GO

-- Note: Platform information will now be retrieved via:
-- PurchaseCalculatorItems -> CatalogProducts -> CatalogProductGames -> Platforms
-- This ensures single source of truth for product-platform relationships
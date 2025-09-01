-- =========================================================
-- CLEANUP SCRIPT: Delete All Products and Related Data
-- =========================================================
-- This script will delete all catalog products and cascade through all dependent tables
-- Use with extreme caution - this will delete ALL product data!

SET NOCOUNT ON;
PRINT 'Starting cleanup of all product data...';

BEGIN TRY
    BEGIN TRANSACTION;
    
    -- Step 1: Delete Purchase Calculator Items (cascades from sessions via FK)
    PRINT 'Deleting Purchase Calculator Items...';
    DELETE FROM dbo.PurchaseCalculatorItems;
    PRINT '  - Deleted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' calculator items';
    
    -- Step 2: Delete Purchase Calculator Sessions
    PRINT 'Deleting Purchase Calculator Sessions...';
    DELETE FROM dbo.PurchaseCalculatorSessions;
    PRINT '  - Deleted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' calculator sessions';
    
    -- Step 3: Delete Inventory Items (depends on PurchaseOrderItems)
    PRINT 'Deleting Inventory Items...';
    DELETE FROM dbo.InventoryItems;
    PRINT '  - Deleted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' inventory items';
    
    -- Step 4: Delete Receiving Events (depends on PurchaseOrderItems and Variants)
    PRINT 'Deleting Receiving Events...';
    DELETE FROM dbo.ReceivingEvents;
    PRINT '  - Deleted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' receiving events';
    
    -- Step 5: Delete Purchase Order Items (depends on Variants and CatalogProducts)
    PRINT 'Deleting Purchase Order Items...';
    DELETE FROM dbo.PurchaseOrderItems;
    PRINT '  - Deleted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' purchase order items';
    
    -- Step 6: Delete Purchase Orders that no longer have items
    PRINT 'Deleting Empty Purchase Orders...';
    DELETE po FROM dbo.PurchaseOrders po
    WHERE NOT EXISTS (SELECT 1 FROM dbo.PurchaseOrderItems poi WHERE poi.purchase_order_id = po.purchase_order_id);
    PRINT '  - Deleted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' empty purchase orders';
    
    -- Step 7: Delete Listing Variants (depends on CatalogProducts)
    PRINT 'Deleting Listing Variants...';
    DELETE FROM dbo.ListingVariants;
    PRINT '  - Deleted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' listing variants';
    
    -- Step 8: Delete Platform associations
    PRINT 'Deleting Catalog Product Platform associations...';
    DELETE FROM dbo.CatalogProductPlatforms;
    PRINT '  - Deleted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' platform associations';
    
    -- Step 9: Delete Console-specific product data
    PRINT 'Deleting Console product data...';
    DELETE FROM dbo.CatalogProductConsoles;
    PRINT '  - Deleted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' console products';
    
    -- Step 10: Delete Game-specific product data
    PRINT 'Deleting Game product data...';
    DELETE FROM dbo.CatalogProductGames;
    PRINT '  - Deleted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' game products';
    
    -- Step 11: Finally, delete the main Catalog Products
    PRINT 'Deleting Catalog Products...';
    DELETE FROM dbo.CatalogProducts;
    PRINT '  - Deleted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' catalog products';
    
    -- Reset identity seeds to start fresh (SQL Server compatible)
    PRINT 'Resetting identity seeds...';
    DECLARE @count INT;
    
    SELECT @count = COUNT(*) FROM dbo.CatalogProducts;
    IF @count = 0
    BEGIN
        DBCC CHECKIDENT ('dbo.CatalogProducts', RESEED, 0);
        PRINT '  - Reset CatalogProducts identity seed';
    END
    
    SELECT @count = COUNT(*) FROM dbo.ListingVariants;
    IF @count = 0
    BEGIN
        DBCC CHECKIDENT ('dbo.ListingVariants', RESEED, 0);
        PRINT '  - Reset ListingVariants identity seed';
    END
    
    SELECT @count = COUNT(*) FROM dbo.PurchaseCalculatorSessions;
    IF @count = 0
    BEGIN
        DBCC CHECKIDENT ('dbo.PurchaseCalculatorSessions', RESEED, 0);
        PRINT '  - Reset PurchaseCalculatorSessions identity seed';
    END
    
    SELECT @count = COUNT(*) FROM dbo.PurchaseCalculatorItems;
    IF @count = 0
    BEGIN
        DBCC CHECKIDENT ('dbo.PurchaseCalculatorItems', RESEED, 0);
        PRINT '  - Reset PurchaseCalculatorItems identity seed';
    END
    
    SELECT @count = COUNT(*) FROM dbo.InventoryItems;
    IF @count = 0
    BEGIN
        DBCC CHECKIDENT ('dbo.InventoryItems', RESEED, 0);
        PRINT '  - Reset InventoryItems identity seed';
    END
    
    -- Also reset PurchaseOrderItems if empty
    SELECT @count = COUNT(*) FROM dbo.PurchaseOrderItems;
    IF @count = 0
    BEGIN
        DBCC CHECKIDENT ('dbo.PurchaseOrderItems', RESEED, 0);
        PRINT '  - Reset PurchaseOrderItems identity seed';
    END
    
    COMMIT TRANSACTION;
    PRINT 'SUCCESS: All product data has been deleted and identity seeds reset.';
    PRINT 'The database is now clean and ready for fresh product data.';
    
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    
    DECLARE @ErrorMessage NVARCHAR(4000), @ErrorNumber INT, @ErrorLine INT;
    SELECT 
        @ErrorMessage = ERROR_MESSAGE(),
        @ErrorNumber = ERROR_NUMBER(),
        @ErrorLine = ERROR_LINE();
    
    PRINT 'ERROR: Transaction rolled back due to error:';
    PRINT 'Error Number: ' + CAST(@ErrorNumber AS VARCHAR(10));
    PRINT 'Error Message: ' + @ErrorMessage;
    PRINT 'Error Line: ' + CAST(@ErrorLine AS VARCHAR(10));
    
    THROW;
END CATCH

-- Final verification - show remaining counts
PRINT '';
PRINT 'Final verification - remaining record counts:';

DECLARE @CatalogCount INT, @VariantCount INT, @SessionCount INT, @ItemCount INT, @POCount INT, @InvCount INT;

SELECT @CatalogCount = COUNT(*) FROM dbo.CatalogProducts;
SELECT @VariantCount = COUNT(*) FROM dbo.ListingVariants;
SELECT @SessionCount = COUNT(*) FROM dbo.PurchaseCalculatorSessions;
SELECT @ItemCount = COUNT(*) FROM dbo.PurchaseCalculatorItems;
SELECT @POCount = COUNT(*) FROM dbo.PurchaseOrderItems;
SELECT @InvCount = COUNT(*) FROM dbo.InventoryItems;

PRINT 'CatalogProducts: ' + CAST(@CatalogCount AS VARCHAR(10));
PRINT 'ListingVariants: ' + CAST(@VariantCount AS VARCHAR(10));
PRINT 'PurchaseCalculatorSessions: ' + CAST(@SessionCount AS VARCHAR(10));
PRINT 'PurchaseCalculatorItems: ' + CAST(@ItemCount AS VARCHAR(10));
PRINT 'PurchaseOrderItems: ' + CAST(@POCount AS VARCHAR(10));
PRINT 'InventoryItems: ' + CAST(@InvCount AS VARCHAR(10));
PRINT '';
PRINT 'Cleanup completed successfully!';
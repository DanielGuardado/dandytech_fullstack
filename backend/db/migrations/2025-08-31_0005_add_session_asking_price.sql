-- Add asking_price to PurchaseCalculatorSessions
-- This field tracks the seller's total asking price for the entire lot
-- Allows comparison against calculated total purchase price

ALTER TABLE dbo.PurchaseCalculatorSessions
ADD asking_price DECIMAL(10,2) NULL;
GO

-- Add documentation for the new field
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Total asking price from seller for the entire lot. Used to compare against calculated total purchase price to evaluate if the lot is worth the asking amount.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'PurchaseCalculatorSessions',
    @level2type = N'COLUMN', @level2name = N'asking_price';
GO
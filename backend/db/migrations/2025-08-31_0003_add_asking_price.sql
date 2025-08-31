-- Add asking_price to track actual seller asking price for comparison
-- This field allows users to input the real asking price and compare it
-- against their calculated maximum purchase price for deal evaluation

ALTER TABLE dbo.PurchaseCalculatorItems
ADD asking_price DECIMAL(10,2) NULL;
GO

-- Add documentation for the new field
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Actual asking price from seller for comparison against calculated purchase price. Used to evaluate if a lot is worth the asking amount.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'PurchaseCalculatorItems',
    @level2type = N'COLUMN', @level2name = N'asking_price';
GO
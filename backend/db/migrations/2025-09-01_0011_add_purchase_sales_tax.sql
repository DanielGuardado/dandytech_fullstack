-- Add purchase sales tax field to track local sales tax paid when purchasing items
-- This is separate from the sales_tax field which tracks tax charged to buyers

-- Add purchase_sales_tax column to store local sales tax on purchases
ALTER TABLE dbo.PurchaseCalculatorItems 
ADD purchase_sales_tax DECIMAL(10,2) NULL;
GO

-- Add comment to clarify the purpose
EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Local sales tax paid when purchasing this item (different from sales_tax which is charged to buyers)',
    @level0type = N'SCHEMA',
    @level0name = N'dbo',
    @level1type = N'TABLE',
    @level1name = N'PurchaseCalculatorItems',
    @level2type = N'COLUMN',
    @level2name = N'purchase_sales_tax';
GO

-- Note: Existing rows will have NULL values for this new column
-- They can be recalculated based on the tax_exempt setting when items are next updated
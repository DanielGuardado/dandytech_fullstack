-- Add session-level toggles for cashback and tax exemption
-- This allows users to toggle cashback calculation and tax exemption per session

-- Add cashback_enabled column (default enabled - most purchases include cashback)
ALTER TABLE dbo.PurchaseCalculatorSessions 
ADD cashback_enabled BIT NOT NULL DEFAULT 1;
GO

-- Add tax_exempt column (default exempt - most purchases are tax exempt)
ALTER TABLE dbo.PurchaseCalculatorSessions 
ADD tax_exempt BIT NOT NULL DEFAULT 1;
GO

-- Create index for performance on the new boolean fields
CREATE INDEX IX_PurchaseCalculatorSessions_Toggles 
ON dbo.PurchaseCalculatorSessions(cashback_enabled, tax_exempt);
GO
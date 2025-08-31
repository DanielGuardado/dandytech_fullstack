-- Add deduction fields to PurchaseCalculatorItems table
-- This supports flexible pricing deductions with reasons tracking

ALTER TABLE dbo.PurchaseCalculatorItems
ADD 
  deductions DECIMAL(10,2) NULL DEFAULT 0,
  deduction_reasons NVARCHAR(MAX) NULL, -- JSON: {"no_manual": 3.50, "damaged_case": 2.00}
  has_manual BIT NULL; -- Track manual status for CIB items
GO

-- Add constraint to ensure deduction_reasons is valid JSON when present
ALTER TABLE dbo.PurchaseCalculatorItems
ADD CONSTRAINT CK_PurchaseCalculatorItems_DeductionReasonsJson
CHECK (deduction_reasons IS NULL OR ISJSON(deduction_reasons) = 1);
GO

-- Update existing items to have default deductions of 0
UPDATE dbo.PurchaseCalculatorItems 
SET deductions = 0 
WHERE deductions IS NULL;
GO

-- Verify the new columns
SELECT TOP 5 
  item_id, 
  product_title, 
  variant_type_code, 
  deductions, 
  deduction_reasons, 
  has_manual
FROM dbo.PurchaseCalculatorItems;
GO
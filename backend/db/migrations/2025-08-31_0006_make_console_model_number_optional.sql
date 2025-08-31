-- Make console model_number field optional
-- This allows consoles to be created without specifying a model number

ALTER TABLE dbo.CatalogProductConsoles 
ALTER COLUMN model_number NVARCHAR(50) NULL;
GO
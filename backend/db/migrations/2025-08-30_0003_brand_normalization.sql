/* =========================================================
   MIGRATION: Brand Normalization
   Created: 2025-08-30
   Description: Normalize brands into separate table with platform relationships
   ========================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Step 1: Create Brands table
CREATE TABLE dbo.Brands (
    brand_id        INT IDENTITY(1,1) PRIMARY KEY,
    name            NVARCHAR(100) NOT NULL UNIQUE,
    is_active       BIT NOT NULL DEFAULT(1),
    created_at      DATETIME2 NOT NULL DEFAULT(SYSDATETIME()),
    updated_at      DATETIME2 NOT NULL DEFAULT(SYSDATETIME())
);
GO

-- Step 2: Insert known platform brands first
INSERT INTO dbo.Brands (name) VALUES 
    ('Sony'),
    ('Microsoft'), 
    ('Nintendo'),
    ('Sega'),
    ('Atari'),
    ('SNK'),
    ('Bandai Namco'),
    ('Capcom'),
    ('Square Enix'),
    ('Electronic Arts'),
    ('Activision'),
    ('Ubisoft'),
    ('Take-Two Interactive'),
    ('Konami'),
    ('Valve');
GO

-- Step 3: Insert unique brands from existing CatalogProducts (excluding nulls and existing brands)
INSERT INTO dbo.Brands (name)
SELECT DISTINCT cp.brand
FROM dbo.CatalogProducts cp
WHERE cp.brand IS NOT NULL 
    AND cp.brand != ''
    AND cp.brand NOT IN (SELECT name FROM dbo.Brands);
GO

-- Step 4: Add brand_id column to Platforms table
ALTER TABLE dbo.Platforms 
ADD brand_id INT NULL;
GO

-- Step 5: Add foreign key constraint for Platforms.brand_id
ALTER TABLE dbo.Platforms
ADD CONSTRAINT FK_Platforms_Brands
    FOREIGN KEY (brand_id) REFERENCES dbo.Brands(brand_id);
GO

-- Step 6: Update Platforms with their corresponding brands
UPDATE dbo.Platforms 
SET brand_id = (SELECT brand_id FROM dbo.Brands WHERE name = 'Sony')
WHERE name IN ('PlayStation', 'PlayStation 2', 'PlayStation 3', 'PlayStation 4', 'PlayStation 5', 'PlayStation Portable', 'PlayStation Vita');

UPDATE dbo.Platforms 
SET brand_id = (SELECT brand_id FROM dbo.Brands WHERE name = 'Microsoft')
WHERE name IN ('Xbox', 'Xbox 360', 'Xbox One', 'Xbox Series X/S');

UPDATE dbo.Platforms 
SET brand_id = (SELECT brand_id FROM dbo.Brands WHERE name = 'Nintendo')
WHERE name IN ('Nintendo Switch', 'Nintendo 3DS', 'Nintendo DS', 'Game Boy Advance', 'GameCube', 'Wii', 'Wii U', 'Nintendo 64', 'Super Nintendo', 'Nintendo Entertainment System', 'Game Boy', 'Game Boy Color');

UPDATE dbo.Platforms 
SET brand_id = (SELECT brand_id FROM dbo.Brands WHERE name = 'Sega')
WHERE name IN ('Sega Genesis', 'Sega Saturn', 'Sega Dreamcast', 'Sega Game Gear', 'Sega Master System', 'Sega CD', 'Sega 32X');

UPDATE dbo.Platforms 
SET brand_id = (SELECT brand_id FROM dbo.Brands WHERE name = 'Atari')
WHERE name IN ('Atari 2600', 'Atari 5200', 'Atari 7800', 'Atari Jaguar', 'Atari Lynx');
GO

-- Step 7: Add brand_id column to CatalogProducts table
ALTER TABLE dbo.CatalogProducts 
ADD brand_id INT NULL;
GO

-- Step 8: Add foreign key constraint for CatalogProducts.brand_id
ALTER TABLE dbo.CatalogProducts
ADD CONSTRAINT FK_CatalogProducts_Brands
    FOREIGN KEY (brand_id) REFERENCES dbo.Brands(brand_id);
GO

-- Step 9: Update CatalogProducts.brand_id from existing brand strings
UPDATE dbo.CatalogProducts 
SET brand_id = b.brand_id
FROM dbo.CatalogProducts cp
JOIN dbo.Brands b ON cp.brand = b.name
WHERE cp.brand IS NOT NULL AND cp.brand != '';
GO

-- Step 10: Drop the old brand column from CatalogProducts
ALTER TABLE dbo.CatalogProducts 
DROP COLUMN brand;
GO

-- Step 11: Add include_short_name column to Platforms (from previous migration if not exists)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Platforms') AND name = 'include_short_name')
BEGIN
    ALTER TABLE dbo.Platforms ADD include_short_name BIT NOT NULL DEFAULT 0;
END
GO

-- Step 12: Update updated_at trigger for Brands table
IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_Brands_UpdatedAt')
BEGIN
    EXEC('
    CREATE TRIGGER TR_Brands_UpdatedAt ON dbo.Brands
    AFTER UPDATE AS
    BEGIN
        SET NOCOUNT ON;
        UPDATE dbo.Brands 
        SET updated_at = SYSDATETIME()
        WHERE brand_id IN (SELECT brand_id FROM inserted);
    END');
END
GO

-- Migration complete
PRINT 'Brand normalization migration completed successfully';
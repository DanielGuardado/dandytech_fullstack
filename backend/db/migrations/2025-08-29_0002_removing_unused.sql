ALTER TABLE InventoryItems DROP CONSTRAINT CK_Inv_DefectsJson
DROP INDEX UX_ListingVariants_ActiveCombo ON ListingVariants
ALTER TABLE CatalogProductConsoles DROP COLUMN region_default
ALTER TABLE CatalogProductGames DROP COLUMN region
ALTER TABLE CatalogProductGames DROP COLUMN edition

ALTER TABLE ConditionGrades add ebay_grade_equivalent VARCHAR(20) NULL
ALTER TABLE InventoryItems DROP COLUMN defects_json
ALTER TABLE InventoryItems DROP COLUMN tested
ALTER TABLE InventoryItems DROP COLUMN serial_number
ALTER TABLE ListingVariants DROP COLUMN packaging_type
ALTER TABLE Platforms add include_short_name BIT NOT NULL DEFAULT 0


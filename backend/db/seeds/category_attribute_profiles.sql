DECLARE @cat_video_games INT = (SELECT TOP 1 category_id FROM dbo.Categories WHERE name LIKE N'%Video Game%');
DECLARE @cat_consoles   INT = (SELECT TOP 1 category_id FROM dbo.Categories WHERE name LIKE N'%Console%');
DECLARE @p_game INT = (SELECT profile_id FROM dbo.AttributeProfiles WHERE name='InventoryItem:VideoGame' AND entity='inventory_item');
DECLARE @p_console INT = (SELECT profile_id FROM dbo.AttributeProfiles WHERE name='InventoryItem:Console' AND entity='inventory_item');

IF @cat_video_games IS NULL OR @cat_consoles IS NULL OR @p_game IS NULL OR @p_console IS NULL
  THROW 50003, 'Seed categories & profiles first', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.CategoryAttributeProfiles WHERE category_id=@cat_video_games AND entity='inventory_item' AND variant_type_id IS NULL)
  INSERT INTO dbo.CategoryAttributeProfiles(category_id, entity, variant_type_id, profile_id)
  VALUES (@cat_video_games, 'inventory_item', NULL, @p_game);

IF NOT EXISTS (SELECT 1 FROM dbo.CategoryAttributeProfiles WHERE category_id=@cat_consoles AND entity='inventory_item' AND variant_type_id IS NULL)
  INSERT INTO dbo.CategoryAttributeProfiles(category_id, entity, variant_type_id, profile_id)
  VALUES (@cat_consoles, 'inventory_item', NULL, @p_console);
GO
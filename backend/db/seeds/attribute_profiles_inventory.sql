-- Profiles (InventoryItem: VideoGame, Console) + fields (not required for now)
DECLARE @p_game INT, @p_console INT;
IF NOT EXISTS (SELECT 1 FROM dbo.AttributeProfiles WHERE name = 'InventoryItem:VideoGame' AND entity='inventory_item')
  INSERT INTO dbo.AttributeProfiles(name, entity) VALUES ('InventoryItem:VideoGame', 'inventory_item');
IF NOT EXISTS (SELECT 1 FROM dbo.AttributeProfiles WHERE name = 'InventoryItem:Console' AND entity='inventory_item')
  INSERT INTO dbo.AttributeProfiles(name, entity) VALUES ('InventoryItem:Console', 'inventory_item');
SELECT @p_game = profile_id FROM dbo.AttributeProfiles WHERE name='InventoryItem:VideoGame' AND entity='inventory_item';
SELECT @p_console = profile_id FROM dbo.AttributeProfiles WHERE name='InventoryItem:Console' AND entity='inventory_item';

IF NOT EXISTS (SELECT 1 FROM dbo.AttributeProfileFields WHERE profile_id=@p_game)
BEGIN
  INSERT INTO dbo.AttributeProfileFields(profile_id, key_name, data_type, is_required, display_label, display_group, display_order) VALUES
  (@p_game, 'inserts',              'bool', 0, 'Inserts included', 'Testing',   10),
  (@p_game, 'tested',               'bool', 0, 'Tested',           'Testing',   20),
  (@p_game, 'disc_details',         'text', 0, 'Disc details',     'Condition', 30),
  (@p_game, 'case_condition',       'text', 0, 'Case condition',   'Condition', 40),
  (@p_game, 'cartridge_condition',  'text', 0, 'Cartridge cond.',  'Condition', 50),
  (@p_game, 'art_condition',        'text', 0, 'Art condition',    'Condition', 60),
  (@p_game, 'notes',                'text', 0, 'Notes',            'Notes',     70),
  (@p_game, 'defects',              'text', 0, 'Defects',          'Condition', 80);
END

IF NOT EXISTS (SELECT 1 FROM dbo.AttributeProfileFields WHERE profile_id=@p_console)
BEGIN
  INSERT INTO dbo.AttributeProfileFields(profile_id, key_name, data_type, is_required, display_label, display_group, display_order) VALUES
  (@p_console, 'firmware',                'text',   0, 'Firmware',               'Device',      10),
  (@p_console, 'serial_number',           'string', 0, 'Serial number',          'Device',      20),
  (@p_console, 'model_number',            'string', 0, 'Model number',           'Device',      30),
  (@p_console, 'condition_description',   'text',   0, 'Condition description',  'Condition',   40),
  (@p_console, 'tested',                  'bool',   0, 'Tested',                 'Testing',     50),
  (@p_console, 'notes',                   'text',   0, 'Notes',                  'Notes',       60),
  (@p_console, 'thermal_paste_replaced',  'bool',   0, 'Thermal paste replaced', 'Service',     70),
  (@p_console, 'controller_description',  'text',   0, 'Controller description', 'Accessories', 80),
  (@p_console, 'cables_included',         'text',   0, 'Cables included',        'Accessories', 90),
  (@p_console, 'memory_card_included',    'bool',   0, 'Memory card included',   'Accessories', 100);
END
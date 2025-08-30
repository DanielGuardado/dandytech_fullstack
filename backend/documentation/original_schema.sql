/* =========================================================
   SCHEMA: Resale Core (Clean, consolidated)
   ========================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* =========================
   0) Lookups
   ========================= */
CREATE TABLE dbo.Categories (
  category_id     INT IDENTITY(1,1) PRIMARY KEY,
  name            NVARCHAR(100) NOT NULL UNIQUE,
  is_active       BIT NOT NULL DEFAULT(1),
  created_at      DATETIME2 NOT NULL DEFAULT(SYSDATETIME())
);
GO

CREATE TABLE dbo.Platforms (
  platform_id     INT IDENTITY(1,1) PRIMARY KEY,
  name            NVARCHAR(100) NOT NULL,
  short_name      NVARCHAR(20)  NULL,
  category_id     INT NOT NULL,
  is_active       BIT NOT NULL DEFAULT(1),
  created_at      DATETIME2 NOT NULL DEFAULT(SYSDATETIME()),
  CONSTRAINT FK_Platforms_Categories
    FOREIGN KEY (category_id) REFERENCES dbo.Categories(category_id)
);
GO

/* =========================
   1) Catalog (base + children)
   ========================= */
CREATE TABLE dbo.CatalogProducts (
  catalog_product_id   INT IDENTITY(1,1) PRIMARY KEY,
  category_id          INT NOT NULL,
  title                NVARCHAR(255) NOT NULL,
  brand                NVARCHAR(100) NULL,
  upc                  VARCHAR(50) NULL,          -- unique when present
  release_year         SMALLINT NULL,
  attributes_json      NVARCHAR(MAX) NULL,        -- category-specific details (JSON)
  pricecharting_id     VARCHAR(40) NULL,
  not_on_pc            BIT NOT NULL CONSTRAINT DF_CatalogProducts_NotOnPC DEFAULT(0),
  created_at           DATETIME2 NOT NULL DEFAULT(SYSDATETIME()),
  updated_at           DATETIME2 NOT NULL DEFAULT(SYSDATETIME()),
  CONSTRAINT FK_CatalogProducts_Categories
    FOREIGN KEY (category_id) REFERENCES dbo.Categories(category_id),
  CONSTRAINT CK_CatalogProducts_AttrJson
    CHECK (attributes_json IS NULL OR ISJSON(attributes_json)=1)
);
GO

CREATE UNIQUE INDEX UX_CatalogProducts_UPC
  ON dbo.CatalogProducts(upc)
  WHERE upc IS NOT NULL;
GO

CREATE UNIQUE INDEX UX_CatalogProducts_PriceChartingId
  ON dbo.CatalogProducts(pricecharting_id)
  WHERE pricecharting_id IS NOT NULL;
GO

CREATE TABLE dbo.CatalogProductGames (
  catalog_product_id   INT PRIMARY KEY,
  platform_id          INT NOT NULL,
  region               NVARCHAR(20) NULL,
  edition              NVARCHAR(100) NULL,
  CONSTRAINT FK_CPG_Catalog
    FOREIGN KEY (catalog_product_id) REFERENCES dbo.CatalogProducts(catalog_product_id),
  CONSTRAINT FK_CPG_Platforms
    FOREIGN KEY (platform_id) REFERENCES dbo.Platforms(platform_id)
);
GO

CREATE TABLE dbo.CatalogProductConsoles (
  catalog_product_id     INT PRIMARY KEY,
  model_number           NVARCHAR(50) NOT NULL,
  storage_capacity_gb    INT NULL,
  firmware_sensitive     BIT NOT NULL DEFAULT(0),
  region_default         NVARCHAR(20) NULL,
  CONSTRAINT FK_CPC_Catalog
    FOREIGN KEY (catalog_product_id) REFERENCES dbo.CatalogProducts(catalog_product_id)
);
GO

CREATE TABLE dbo.CatalogProductPlatforms (
  catalog_product_id   INT NOT NULL,
  platform_id          INT NOT NULL,
  CONSTRAINT PK_CatalogProductPlatforms PRIMARY KEY (catalog_product_id, platform_id),
  CONSTRAINT FK_CPP_Catalog
    FOREIGN KEY (catalog_product_id) REFERENCES dbo.CatalogProducts(catalog_product_id),
  CONSTRAINT FK_CPP_Platforms
    FOREIGN KEY (platform_id) REFERENCES dbo.Platforms(platform_id)
);
GO

/* =========================
   2) Variant Types & Listing Variants
   ========================= */
CREATE TABLE dbo.VariantTypes (
  variant_type_id   INT IDENTITY(1,1) PRIMARY KEY,
  code              VARCHAR(40) NOT NULL UNIQUE,   -- LOOSE | ORIGINAL_PACKAGING | NEW
  display_name      NVARCHAR(100) NOT NULL,
  is_active         BIT NOT NULL DEFAULT(1)
);
GO

CREATE TABLE dbo.ListingVariants (
  variant_id            INT IDENTITY(1,1) PRIMARY KEY,
  catalog_product_id    INT NOT NULL,
  variant_type_id       INT NOT NULL,
  packaging_type        NVARCHAR(50) NULL,
  current_market_value  DECIMAL(10,2) NULL,        -- cache only
  default_list_price    DECIMAL(10,2) NULL,
  is_active             BIT NOT NULL DEFAULT(1),
  created_at            DATETIME2 NOT NULL DEFAULT(SYSDATETIME()),
  updated_at            DATETIME2 NOT NULL DEFAULT(SYSDATETIME()),
  CONSTRAINT FK_Variants_Catalog
    FOREIGN KEY (catalog_product_id) REFERENCES dbo.CatalogProducts(catalog_product_id),
  CONSTRAINT FK_Variants_VariantTypes
    FOREIGN KEY (variant_type_id) REFERENCES dbo.VariantTypes(variant_type_id)
);
GO

CREATE UNIQUE INDEX UX_ListingVariants_ActiveCombo
  ON dbo.ListingVariants(catalog_product_id, variant_type_id, packaging_type)
  WHERE is_active = 1;
GO

/* =========================
   3) Operational Lookups
   ========================= */
CREATE TABLE dbo.ConditionGrades (
  condition_grade_id  INT IDENTITY(1,1) PRIMARY KEY,
  code                VARCHAR(40) NOT NULL UNIQUE,
  display_name        NVARCHAR(100) NOT NULL,
  description         NVARCHAR(200) NULL,
  rank                INT NOT NULL,
  is_active           BIT NOT NULL DEFAULT(1)
);
GO

CREATE TABLE dbo.PaymentMethods (
  payment_method_id  INT IDENTITY(1,1) PRIMARY KEY,
  code               VARCHAR(40) NOT NULL UNIQUE,
  display_name       NVARCHAR(100) NOT NULL,
  is_active          BIT NOT NULL DEFAULT(1)
);
GO

CREATE TABLE dbo.Sources (
  source_id   INT IDENTITY(1,1) PRIMARY KEY,
  code        NVARCHAR(20) NOT NULL UNIQUE,
  name        NVARCHAR(200) NOT NULL,
  type        NVARCHAR(50) NOT NULL,         -- Marketplace/Retail/PrivateParty/Wholesale/Other
  is_active   BIT NOT NULL DEFAULT(1),
  created_at  DATETIME2 NOT NULL DEFAULT(SYSDATETIME())
);
GO

/* =========================
   4) Purchase Orders & Items
   ========================= */
CREATE TABLE dbo.PurchaseOrders (
  purchase_order_id     INT IDENTITY(1,1) PRIMARY KEY,
  po_number             NVARCHAR(50) NOT NULL,
  source_id             INT NOT NULL,
  date_purchased        DATE NULL,
  subtotal              DECIMAL(10,2) NOT NULL DEFAULT(0),
  tax                   DECIMAL(10,2) NOT NULL DEFAULT(0),
  shipping              DECIMAL(10,2) NOT NULL DEFAULT(0),
  fees                  DECIMAL(10,2) NOT NULL DEFAULT(0),
  discounts             DECIMAL(10,2) NOT NULL DEFAULT(0),
  total_cost            AS (CONVERT(DECIMAL(12,2), (subtotal + tax + shipping + fees - discounts))) PERSISTED,
  status                VARCHAR(30) NOT NULL
                        CHECK (status IN ('open','partially_received','received','closed_with_exceptions','returned','cancelled')),
  payment_method_id     INT NULL,
  external_order_number NVARCHAR(100) NULL,
  notes                 NVARCHAR(500) NULL,
  is_locked             BIT NOT NULL DEFAULT(0),
  inventory_reviewed_at DATETIME2 NULL,
  inventory_reviewed_by NVARCHAR(100) NULL,
  created_at            DATETIME2 NOT NULL DEFAULT(SYSDATETIME()),
  updated_at            DATETIME2 NOT NULL DEFAULT(SYSDATETIME()),
  CONSTRAINT FK_PurchaseOrders_Sources
    FOREIGN KEY (source_id) REFERENCES dbo.Sources(source_id),
  CONSTRAINT FK_PurchaseOrders_PaymentMethods
    FOREIGN KEY (payment_method_id) REFERENCES dbo.PaymentMethods(payment_method_id)
);
GO

CREATE UNIQUE INDEX UX_PurchaseOrders_Source_PONumber
  ON dbo.PurchaseOrders(source_id, po_number);
GO

CREATE TABLE dbo.PurchaseOrderItems (
  purchase_order_item_id  INT IDENTITY(1,1) PRIMARY KEY,
  purchase_order_id       INT NOT NULL,
  variant_id              INT NOT NULL,
  catalog_product_id      INT NOT NULL,
  quantity_expected       INT NOT NULL CHECK (quantity_expected >= 0),
  quantity_received       INT NOT NULL DEFAULT(0) CHECK (quantity_received >= 0),
  allocation_basis        DECIMAL(10,2) NOT NULL,
  allocation_basis_source VARCHAR(30) NOT NULL
                      CHECK (allocation_basis_source IN ('pricecharting','ebay_sold','other')),
  cost_assignment_method  VARCHAR(20) NOT NULL DEFAULT('by_market_value')
                      CHECK (cost_assignment_method IN ('by_market_value','manual')),
  allocated_unit_cost     DECIMAL(10,2) NULL,
  allocated_total_cost    AS (CONVERT(DECIMAL(12,2), (ISNULL(allocated_unit_cost,0) * CONVERT(DECIMAL(12,2), quantity_expected)))) PERSISTED,
  receive_status          VARCHAR(20) NOT NULL DEFAULT('pending')
                      CHECK (receive_status IN ('pending','partial','received','cancelled','short')),
  attributes_json         NVARCHAR(MAX) NULL,
  notes                   NVARCHAR(500) NULL,
  created_at              DATETIME2 NOT NULL DEFAULT(SYSDATETIME()),
  updated_at              DATETIME2 NOT NULL DEFAULT(SYSDATETIME()),
  CONSTRAINT FK_POI_PO
    FOREIGN KEY (purchase_order_id) REFERENCES dbo.PurchaseOrders(purchase_order_id),
  CONSTRAINT FK_POI_Variant
    FOREIGN KEY (variant_id) REFERENCES dbo.ListingVariants(variant_id),
  CONSTRAINT FK_POI_Catalog
    FOREIGN KEY (catalog_product_id) REFERENCES dbo.CatalogProducts(catalog_product_id),
  CONSTRAINT CK_POI_AttrJson
    CHECK (attributes_json IS NULL OR ISJSON(attributes_json)=1)
);
GO

CREATE TABLE dbo.ReceivingEvents (
  receiving_event_id     INT IDENTITY(1,1) PRIMARY KEY,
  purchase_order_id      INT NOT NULL,
  purchase_order_item_id INT NULL,
  variant_id             INT NOT NULL,
  event_type             VARCHAR(20) NOT NULL
                   CHECK (event_type IN ('receive','short','damage','overage','return_to_vendor','adjust')),
  quantity               INT NOT NULL,
  notes                  NVARCHAR(500) NULL,
  created_by             NVARCHAR(100) NULL,
  created_at             DATETIME2 NOT NULL DEFAULT(SYSDATETIME()),
  CONSTRAINT FK_RE_PO
    FOREIGN KEY (purchase_order_id) REFERENCES dbo.PurchaseOrders(purchase_order_id),
  CONSTRAINT FK_RE_POI
    FOREIGN KEY (purchase_order_item_id) REFERENCES dbo.PurchaseOrderItems(purchase_order_item_id),
  CONSTRAINT FK_RE_Variant
    FOREIGN KEY (variant_id) REFERENCES dbo.ListingVariants(variant_id)
);
GO

/* =========================
   5) Inventory
   ========================= */
CREATE TABLE dbo.InventoryItems (
  inventory_item_id      INT IDENTITY(1,1) PRIMARY KEY,
  purchase_order_item_id INT NOT NULL,
  variant_id             INT NOT NULL,
  seller_sku             NVARCHAR(50) NOT NULL UNIQUE,
  quantity               INT NOT NULL DEFAULT(1) CHECK (quantity >= 0),
  allocated_unit_cost    DECIMAL(10,2) NOT NULL,
  list_price             DECIMAL(10,2) NULL,
  condition_grade_id     INT NOT NULL,
  status                 VARCHAR(20) NOT NULL DEFAULT('Pending')
                       CHECK (status IN ('Pending','Active','Sold','Reserved','Archived','Damaged')),
  title_suffix           NVARCHAR(255) NULL,
  unit_attributes_json   NVARCHAR(MAX) NULL,
  defects_json           NVARCHAR(MAX) NULL,
  location               NVARCHAR(100) NULL,
  is_locked              BIT NOT NULL DEFAULT(0),
  /* computed projections from unit_attributes_json */
  tested                 AS TRY_CONVERT(bit, JSON_VALUE(unit_attributes_json, '$.tested')) PERSISTED,
  serial_number          AS JSON_VALUE(unit_attributes_json, '$.serial_number'),
  created_at             DATETIME2 NOT NULL DEFAULT(SYSDATETIME()),
  updated_at             DATETIME2 NOT NULL DEFAULT(SYSDATETIME()),
  CONSTRAINT FK_Inv_POI
    FOREIGN KEY (purchase_order_item_id) REFERENCES dbo.PurchaseOrderItems(purchase_order_item_id),
  CONSTRAINT FK_Inv_Variant
    FOREIGN KEY (variant_id) REFERENCES dbo.ListingVariants(variant_id),
  CONSTRAINT FK_Inv_CondGrade
    FOREIGN KEY (condition_grade_id) REFERENCES dbo.ConditionGrades(condition_grade_id),
  CONSTRAINT CK_Inv_UnitAttrJson
    CHECK (unit_attributes_json IS NULL OR ISJSON(unit_attributes_json)=1),
  CONSTRAINT CK_Inv_DefectsJson
    CHECK (defects_json IS NULL OR ISJSON(defects_json)=1)
);
GO

CREATE INDEX IX_InventoryItems_OnHand
  ON dbo.InventoryItems(variant_id, status)
  WHERE status = 'Active';
GO

CREATE INDEX IX_Inv_POI ON dbo.InventoryItems(purchase_order_item_id);
GO

/* =========================
   6) Attribute Profiles (entity-aware)
   ========================= */
CREATE TABLE dbo.AttributeProfiles (
  profile_id           INT IDENTITY(1,1) PRIMARY KEY,
  name                 NVARCHAR(100) NOT NULL,
  entity               NVARCHAR(50)  NOT NULL,    -- e.g., 'inventory_item', 'catalog_product'
  version              INT           NOT NULL DEFAULT 1,
  is_active            BIT           NOT NULL DEFAULT 1,
  created_at           DATETIME2(3)  NOT NULL DEFAULT SYSDATETIME(),
  updated_at           DATETIME2(3)  NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.AttributeProfileFields (
  field_id             INT IDENTITY(1,1) PRIMARY KEY,
  profile_id           INT NOT NULL
    REFERENCES dbo.AttributeProfiles(profile_id),
  key_name             NVARCHAR(100) NOT NULL,
  data_type            NVARCHAR(20)  NOT NULL,    -- bool|text|string|int|decimal|date|enum
  is_required          BIT           NOT NULL DEFAULT 0,
  enum_values_json     NVARCHAR(MAX) NULL,
  regex                NVARCHAR(200) NULL,
  min_value            DECIMAL(18,4) NULL,
  max_value            DECIMAL(18,4) NULL,
  default_value        NVARCHAR(MAX) NULL,
  display_label        NVARCHAR(100) NULL,
  display_help         NVARCHAR(500) NULL,
  display_group        NVARCHAR(50)  NULL,
  display_order        INT           NULL
);
GO

CREATE TABLE dbo.CategoryAttributeProfiles (
  category_attribute_profile_id INT IDENTITY(1,1) PRIMARY KEY,
  category_id        INT           NOT NULL
    REFERENCES dbo.Categories(category_id),
  variant_type_id    INT           NULL
    REFERENCES dbo.VariantTypes(variant_type_id),
  entity             NVARCHAR(50)  NOT NULL,
  profile_id         INT           NOT NULL
    REFERENCES dbo.AttributeProfiles(profile_id)
);
GO

CREATE UNIQUE INDEX UX_CatEnt_Variant
  ON dbo.CategoryAttributeProfiles(category_id, entity, variant_type_id)
  WHERE variant_type_id IS NOT NULL;
GO

CREATE UNIQUE INDEX UX_CatEnt_Default
  ON dbo.CategoryAttributeProfiles(category_id, entity)
  WHERE variant_type_id IS NULL;
GO

/* =========================
   7) Inventory Events (audit)
   ========================= */
CREATE TABLE dbo.InventoryEvents (
  inventory_event_id   INT IDENTITY(1,1) PRIMARY KEY,
  inventory_item_id    INT NOT NULL
    REFERENCES dbo.InventoryItems(inventory_item_id),
  event_type           NVARCHAR(50) NOT NULL,      -- 'adjust' (extend later)
  reason               NVARCHAR(50) NULL,          -- 'cycle_count' | 'damage' | 'loss' | 'correction' | 'found'
  delta                INT NULL,                   -- signed qty change (0 for status-only)
  quantity_before      INT NULL,
  quantity_after       INT NULL,
  from_status          NVARCHAR(30) NULL,
  to_status            NVARCHAR(30) NULL,
  notes                NVARCHAR(500) NULL,
  created_at           DATETIME2(3) NOT NULL DEFAULT SYSDATETIME()
);
GO

/* =========================
   8) Seed Data
   ========================= */

/* Categories */
INSERT INTO dbo.Categories(name) VALUES
  (N'Video Game'), (N'Console'), (N'Controller'), (N'Accessory'), (N'Amiibo'), (N'Funko Pop');

/* Variant Types */
INSERT INTO dbo.VariantTypes(code, display_name) VALUES
  ('LOOSE', 'Loose'),
  ('ORIGINAL_PACKAGING', 'Original Packaging'),
  ('NEW', 'New');

/* Condition Grades (rank is UI sort) */
INSERT INTO dbo.ConditionGrades(code, display_name, description, rank) VALUES
  ('UNKNOWN',            'Not Specified',           'Condition not yet graded',               99),
  ('LIKE_NEW',           'Like New',                'Minimal/no wear, open but pristine',      1),
  ('VERY_GOOD',          'Very Good',               'Light wear, fully functional',            2),
  ('VERY_GOOD_REFURB',   'Very Good (Refurbished)', 'Refurbished to very good condition',      3),
  ('GOOD',               'Good',                    'Noticeable wear, fully functional',       4),
  ('GOOD_REFURB',        'Good (Refurbished)',      'Refurbished to good condition',           5),
  ('EXCELLENT_REFURB',   'Excellent (Refurbished)', 'Refurbished to excellent condition',      6),
  ('OPEN_BOX',           'Open Box',                'Opened but unused',                       7),
  ('FOR_PARTS',          'For Parts',               'Not fully functional, may be salvaged',   8),
  ('DAMAGED',            'Damaged',                 'Broken or defective',                     9);

/* Payment Methods */
INSERT INTO dbo.PaymentMethods(code, display_name) VALUES
  ('Cash','Cash'),
  ('CreditCard','Credit Card'),
  ('PayPal','PayPal'),
  ('eBayManaged','eBay Managed Payments'),
  ('Zelle','Zelle'),
  ('ACH','ACH'),
  ('StoreCredit','Store Credit'),
  ('Other','Other');
GO

/* =========================
   9) Suggested Views
   ========================= */
CREATE VIEW dbo.vPO_Progress AS
SELECT
  po.purchase_order_id,
  po.po_number,
  po.status,
  SUM(poi.quantity_expected) AS total_qty_expected,
  SUM(poi.quantity_received) AS total_qty_received,
  CASE
    WHEN SUM(poi.quantity_expected) = 0 THEN 0
    ELSE CAST(100.0 * SUM(poi.quantity_received) / NULLIF(SUM(poi.quantity_expected),0) AS DECIMAL(5,2))
  END AS received_pct
FROM dbo.PurchaseOrders po
JOIN dbo.PurchaseOrderItems poi ON poi.purchase_order_id = po.purchase_order_id
GROUP BY po.purchase_order_id, po.po_number, po.status;
GO

CREATE VIEW dbo.vInventory_OnHand AS
SELECT
  variant_id,
  SUM(quantity) AS quantity_on_hand
FROM dbo.InventoryItems
WHERE status = 'Active'
GROUP BY variant_id;
GO

CREATE VIEW dbo.vPO_WriteOffs AS
SELECT
  purchase_order_item_id,
  purchase_order_id,
  variant_id,
  catalog_product_id,
  quantity_expected,
  quantity_received,
  receive_status,
  allocated_unit_cost,
  allocated_total_cost
FROM dbo.PurchaseOrderItems
WHERE receive_status IN ('short','cancelled');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Sources WHERE code = N'MC')
  INSERT INTO dbo.Sources(code, name, type) VALUES (N'MC', N'Mercari', N'Marketplace');

IF NOT EXISTS (SELECT 1 FROM dbo.Sources WHERE code = N'EB')
  INSERT INTO dbo.Sources(code, name, type) VALUES (N'EB', N'eBay', N'Marketplace');

IF NOT EXISTS (SELECT 1 FROM dbo.Sources WHERE code = N'FB')
  INSERT INTO dbo.Sources(code, name, type) VALUES (N'FB', N'Facebook Marketplace', N'Marketplace');
GO

-- Resolve the Video Game category id (adjust the WHERE if your name differs)
DECLARE @cat_video_games INT = (
  SELECT TOP 1 category_id
  FROM dbo.Categories
  WHERE name LIKE N'%Video Game%'
);

-- Seed Platforms (regular inserts)
INSERT INTO dbo.Platforms(name, short_name, category_id) VALUES
(N'Nintendo Entertainment System', N'NES',     @cat_video_games),
(N'Super Nintendo Entertainment System', N'SNES',   @cat_video_games),
(N'Nintendo 64',                  N'N64',     @cat_video_games),
(N'GameCube',                     N'GC',     @cat_video_games),
(N'Wii',                          N'Wii',     @cat_video_games),
(N'Wii U',                        N'WiiU',    @cat_video_games),
(N'Nintendo Switch',              N'Switch',  @cat_video_games),
(N'Game Boy',                     N'GB',      @cat_video_games),
(N'Game Boy Color',               N'GBC',     @cat_video_games),
(N'Game Boy Advance',             N'GBA',     @cat_video_games),
(N'Nintendo DS',                  N'DS',      @cat_video_games),
(N'Nintendo 3DS',                 N'3DS',     @cat_video_games),

(N'PlayStation',                  N'PS1',     @cat_video_games),
(N'PlayStation 2',                N'PS2',     @cat_video_games),
(N'PlayStation 3',                N'PS3',     @cat_video_games),
(N'PlayStation 4',                N'PS4',     @cat_video_games),
(N'PlayStation 5',                N'PS5',     @cat_video_games),
(N'PlayStation Portable',         N'PSP',     @cat_video_games),
(N'PlayStation Vita',             N'Vita',    @cat_video_games),

(N'Xbox',                         N'Xbox',    @cat_video_games),
(N'Xbox 360',                     N'360',    @cat_video_games),
(N'Xbox One',                     N'XONE',    @cat_video_games),
(N'Xbox Series X|S',              N'XSX|S',   @cat_video_games),

(N'Sega Master System',           N'SMS',     @cat_video_games),
(N'Sega Genesis',                 N'GEN',     @cat_video_games),
(N'Sega Saturn',                  N'SAT',     @cat_video_games),
(N'Dreamcast',                    N'DC',      @cat_video_games),
(N'Game Gear',                    N'GG',      @cat_video_games),

(N'Atari 2600',                   N'A2600',   @cat_video_games),
(N'Atari 5200',                   N'A5200',   @cat_video_games),
(N'Atari 7800',                   N'A7800',   @cat_video_games),
(N'Atari Jaguar',                 N'JAG',     @cat_video_games),
(N'Atari Lynx',                   N'LYNX',    @cat_video_games),

(N'Neo Geo',                      N'NEO',     @cat_video_games),
(N'Neo Geo Pocket Color',         N'NGPC',    @cat_video_games),
(N'TurboGrafx-16',                N'TG16',    @cat_video_games),
(N'PC Engine',                    N'PCE',     @cat_video_games),
(N'3DO',                          N'3DO',     @cat_video_games),
(N'Philips CD-i',                 N'CDI',     @cat_video_games),

(N'PC',                           N'PC',      @cat_video_games);


-- Seed profiles for inventory_item (Video Game & Console)
DECLARE @p_game INT, @p_console INT;
IF NOT EXISTS (SELECT 1 FROM dbo.AttributeProfiles WHERE name = 'InventoryItem:VideoGame' AND entity='inventory_item')
BEGIN
INSERT INTO dbo.AttributeProfiles(name, entity) VALUES ('InventoryItem:VideoGame', 'inventory_item');
END;
SELECT @p_game = profile_id FROM dbo.AttributeProfiles WHERE name='InventoryItem:VideoGame' AND entity='inventory_item';


IF NOT EXISTS (SELECT 1 FROM dbo.AttributeProfiles WHERE name = 'InventoryItem:Console' AND entity='inventory_item')
BEGIN
INSERT INTO dbo.AttributeProfiles(name, entity) VALUES ('InventoryItem:Console', 'inventory_item');
END;
SELECT @p_console = profile_id FROM dbo.AttributeProfiles WHERE name='InventoryItem:Console' AND entity='inventory_item';


DECLARE @p_game INT = (SELECT profile_id FROM dbo.AttributeProfiles WHERE name='InventoryItem:VideoGame' AND entity='inventory_item');
DECLARE @p_console INT = (SELECT profile_id FROM dbo.AttributeProfiles WHERE name='InventoryItem:Console' AND entity='inventory_item');

-- Video Game fields
IF NOT EXISTS (SELECT 1 FROM dbo.AttributeProfileFields WHERE profile_id=@p_game)
BEGIN
  INSERT INTO dbo.AttributeProfileFields(profile_id, key_name, data_type, is_required, display_label, display_group, display_order) VALUES
  (@p_game, 'inserts',              'bool', 1, 'Inserts included', 'Testing',   10),
  (@p_game, 'tested',               'bool', 1, 'Tested',           'Testing',   20),
  (@p_game, 'disc_details',         'text', 1, 'Disc details',     'Condition', 30),
  (@p_game, 'case_condition',       'text', 1, 'Case condition',   'Condition', 40),
  (@p_game, 'cartridge_condition',  'text', 1, 'Cartridge cond.',  'Condition', 50),
  (@p_game, 'art_condition',        'text', 1, 'Art condition',    'Condition', 60),
  (@p_game, 'notes',                'text', 0, 'Notes',            'Notes',     70),
  (@p_game, 'defects',              'text', 0, 'Defects',          'Condition', 80);
END

-- Console fields
IF NOT EXISTS (SELECT 1 FROM dbo.AttributeProfileFields WHERE profile_id=@p_console)
BEGIN
  INSERT INTO dbo.AttributeProfileFields(profile_id, key_name, data_type, is_required, display_label, display_group, display_order) VALUES
  (@p_console, 'firmware',                'text',   1, 'Firmware',               'Device',      10),
  (@p_console, 'serial_number',           'string', 1, 'Serial number',          'Device',      20),
  (@p_console, 'model_number',            'string', 1, 'Model number',           'Device',      30),
  (@p_console, 'condition_description',   'text',   1, 'Condition description',  'Condition',   40),
  (@p_console, 'tested',                  'bool',   1, 'Tested',                 'Testing',     50),
  (@p_console, 'notes',                   'text',   0, 'Notes',                  'Notes',       60),
  (@p_console, 'thermal_paste_replaced',  'bool',   0, 'Thermal paste replaced', 'Service',     70),
  (@p_console, 'controller_description',  'text',   0, 'Controller description', 'Accessories', 80),
  (@p_console, 'cables_included',         'text',   0, 'Cables included',        'Accessories', 90),
  (@p_console, 'memory_card_included',    'bool',   0, 'Memory card included',   'Accessories', 100);
END


DECLARE @cat_video_games INT = (SELECT TOP 1 category_id FROM dbo.Categories WHERE name LIKE '%Video Game%');
DECLARE @cat_consoles   INT = (SELECT TOP 1 category_id FROM dbo.Categories WHERE name LIKE '%Console%');

-- Map default (category-only) for inventory items
IF NOT EXISTS (SELECT 1 FROM dbo.CategoryAttributeProfiles WHERE category_id=@cat_video_games AND entity='inventory_item' AND variant_type_id IS NULL)
  INSERT INTO dbo.CategoryAttributeProfiles(category_id, entity, variant_type_id, profile_id)
  SELECT @cat_video_games, 'inventory_item', NULL, profile_id
  FROM dbo.AttributeProfiles WHERE name='InventoryItem:VideoGame' AND entity='inventory_item';

IF NOT EXISTS (SELECT 1 FROM dbo.CategoryAttributeProfiles WHERE category_id=@cat_consoles AND entity='inventory_item' AND variant_type_id IS NULL)
  INSERT INTO dbo.CategoryAttributeProfiles(category_id, entity, variant_type_id, profile_id)
  SELECT @cat_consoles, 'inventory_item', NULL, profile_id
  FROM dbo.AttributeProfiles WHERE name='InventoryItem:Console' AND entity='inventory_item';

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_CategoryAttributeProfiles_Categories')
BEGIN
  ALTER TABLE dbo.CategoryAttributeProfiles
    ADD CONSTRAINT FK_CategoryAttributeProfiles_Categories
      FOREIGN KEY (category_id) REFERENCES dbo.Categories(category_id);
END

IF OBJECT_ID('dbo.VariantTypes','U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_CategoryAttributeProfiles_VariantTypes')
BEGIN
  ALTER TABLE dbo.CategoryAttributeProfiles
    ADD CONSTRAINT FK_CategoryAttributeProfiles_VariantTypes
      FOREIGN KEY (variant_type_id) REFERENCES dbo.VariantTypes(variant_type_id);
END

IF COL_LENGTH('dbo.InventoryItems','tested') IS NULL
  ALTER TABLE dbo.InventoryItems
  ADD tested AS TRY_CONVERT(bit, JSON_VALUE(unit_attributes_json, '$.tested')) PERSISTED;

IF COL_LENGTH('dbo.InventoryItems','serial_number') IS NULL
  ALTER TABLE dbo.InventoryItems
  ADD serial_number AS JSON_VALUE(unit_attributes_json, '$.serial_number');

update AttributeProfileFields set is_required = 0
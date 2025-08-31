# Database Schema

[← Back to Purchase Calculator Documentation](./README.md)

## Overview for Humans

The purchase calculator uses several database tables to store session data, individual item calculations, and reference data. The schema is designed to maintain audit trails, support different calculation methods, and integrate with the existing catalog system.

### Key Tables
- **calculator_sessions**: Container for grouped calculations
- **calculator_items**: Individual line items with pricing details  
- **Platforms**: Reference data including manual sensitivity flags
- **CatalogProducts & ListingVariants**: Product and pricing data integration

---

## Core Calculator Tables

### calculator_sessions
**Purpose**: Store calculation session metadata and totals
```sql
CREATE TABLE calculator_sessions (
    session_id INT IDENTITY(1,1) PRIMARY KEY,
    session_name NVARCHAR(255) NOT NULL,
    asking_price DECIMAL(10,2) NULL,                    -- Seller's asking price for all items
    status VARCHAR(20) NOT NULL DEFAULT 'draft',        -- draft, finalized, converted_to_po
    total_items INT NULL,                               -- Computed: count of items
    total_estimated_revenue DECIMAL(12,2) NULL,         -- Computed: sum of sale prices
    total_purchase_cost DECIMAL(12,2) NULL,             -- Computed: sum of purchase prices
    expected_profit_margin DECIMAL(5,4) NULL,           -- Computed: overall margin
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- Indexes
CREATE INDEX IX_calculator_sessions_status ON calculator_sessions(status);
CREATE INDEX IX_calculator_sessions_created_at ON calculator_sessions(created_at DESC);
```

### calculator_items  
**Purpose**: Store individual line items with detailed pricing calculations
```sql
CREATE TABLE calculator_items (
    item_id INT IDENTITY(1,1) PRIMARY KEY,
    session_id INT NOT NULL,
    
    -- Product References
    catalog_product_id INT NOT NULL,                    -- Link to CatalogProducts
    variant_id INT NOT NULL,                            -- Link to ListingVariants
    
    -- Pricing Data
    estimated_sale_price DECIMAL(10,2) NOT NULL,       -- Market value from PriceCharting
    purchase_price DECIMAL(10,2) NOT NULL,             -- Calculated optimal purchase price
    quantity INT NOT NULL DEFAULT 1,                   -- Quantity of this item
    
    -- Deductions System
    custom_deductions DECIMAL(10,2) NULL DEFAULT 0,    -- User-specified deductions
    deductions DECIMAL(10,2) NULL DEFAULT 0,           -- Applied deductions (auto or custom)
    deduction_reasons NVARCHAR(500) NULL,              -- Explanation of deductions
    has_manual BIT NULL,                                -- Manual inclusion status (CIB items)
    
    -- Additional Data
    notes NVARCHAR(1000) NULL,                         -- User notes about condition, etc.
    
    -- Audit Trail
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    
    -- Constraints
    FOREIGN KEY (session_id) REFERENCES calculator_sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (catalog_product_id) REFERENCES CatalogProducts(catalog_product_id),
    FOREIGN KEY (variant_id) REFERENCES ListingVariants(variant_id),
    
    -- Ensure positive values
    CHECK (estimated_sale_price > 0),
    CHECK (purchase_price >= 0),
    CHECK (quantity > 0),
    CHECK (custom_deductions >= 0),
    CHECK (deductions >= 0)
);

-- Indexes  
CREATE INDEX IX_calculator_items_session_id ON calculator_items(session_id);
CREATE INDEX IX_calculator_items_catalog_product_id ON calculator_items(catalog_product_id);
CREATE INDEX IX_calculator_items_variant_id ON calculator_items(variant_id);
CREATE INDEX IX_calculator_items_created_at ON calculator_items(created_at DESC);
```

## Platform Integration Tables

### Platforms (Enhanced)
**Purpose**: Platform reference data with manual sensitivity configuration
```sql
-- Existing table enhanced with manual sensitivity
ALTER TABLE Platforms 
ADD video_game_manual_sensitive BIT NOT NULL DEFAULT 0;

-- Set manual-sensitive platforms (physical manuals expected for CIB)
UPDATE Platforms 
SET video_game_manual_sensitive = 1
WHERE short_name IN ('PS2', 'PS3', 'Xbox', '360', 'GC', 'Wii');

-- Sample data
SELECT platform_id, name, short_name, video_game_manual_sensitive 
FROM Platforms
WHERE video_game_manual_sensitive = 1
ORDER BY name;

/*
platform_id | name           | short_name | video_game_manual_sensitive
3          | PlayStation 2  | PS2        | 1  
4          | PlayStation 3  | PS3        | 1
7          | Xbox          | Xbox       | 1
8          | Xbox 360      | 360        | 1
12         | GameCube      | GC         | 1
15         | Wii           | Wii        | 1
*/
```

### CatalogProducts Integration
**Purpose**: Link calculator items to catalog system
```sql
-- No schema changes needed - existing table structure works
SELECT 
    cp.catalog_product_id,
    cp.title,
    cp.category_id,
    c.name as category_name,
    cp.brand_id,
    b.name as brand_name,
    cp.upc,
    cp.release_year
FROM CatalogProducts cp
JOIN Categories c ON c.category_id = cp.category_id
LEFT JOIN Brands b ON b.brand_id = cp.brand_id
WHERE cp.catalog_product_id IN (SELECT DISTINCT catalog_product_id FROM calculator_items);
```

### ListingVariants Integration
**Purpose**: Link calculator items to specific product variants with market pricing
```sql
-- Enhanced query to include platform data
SELECT 
    lv.variant_id,
    lv.catalog_product_id,
    lv.variant_type_id,
    vt.code as variant_type_code,
    vt.display_name,
    lv.current_market_value,
    lv.default_list_price,
    lv.is_active,
    p.short_name as platform_short,
    p.video_game_manual_sensitive as platform_manual_sensitive
FROM ListingVariants lv
JOIN VariantTypes vt ON vt.variant_type_id = lv.variant_type_id
LEFT JOIN CatalogProductGames cpg ON cpg.catalog_product_id = lv.catalog_product_id  
LEFT JOIN Platforms p ON p.platform_id = cpg.platform_id
WHERE lv.variant_id IN (SELECT DISTINCT variant_id FROM calculator_items)
  AND lv.is_active = 1;
```

## Data Relationships

### Entity Relationship Diagram
```
calculator_sessions (1) ──────── (M) calculator_items
                                         │
                                         ├── (M) CatalogProducts (1)
                                         │            │
                                         │            ├── (1) Categories (1)  
                                         │            ├── (1) Brands (0..1)
                                         │            └── (1) CatalogProductGames (0..1) ── (1) Platforms
                                         │
                                         └── (M) ListingVariants (1) ── (1) VariantTypes
```

### Foreign Key Constraints
```sql
-- calculator_items foreign keys
ALTER TABLE calculator_items 
ADD CONSTRAINT FK_calculator_items_session 
    FOREIGN KEY (session_id) REFERENCES calculator_sessions(session_id) ON DELETE CASCADE;

ALTER TABLE calculator_items 
ADD CONSTRAINT FK_calculator_items_catalog_product 
    FOREIGN KEY (catalog_product_id) REFERENCES CatalogProducts(catalog_product_id);
    
ALTER TABLE calculator_items 
ADD CONSTRAINT FK_calculator_items_variant 
    FOREIGN KEY (variant_id) REFERENCES ListingVariants(variant_id);
```

## Data Access Patterns

### Common Queries

#### Load Session with Items
```sql
-- Main session data
SELECT s.*, 
       COUNT(i.item_id) as total_items,
       SUM(i.estimated_sale_price * i.quantity) as total_estimated_revenue,
       SUM(i.purchase_price * i.quantity) as total_purchase_cost,
       CASE WHEN SUM(i.estimated_sale_price * i.quantity) > 0 
            THEN (SUM(i.estimated_sale_price * i.quantity) - SUM(i.purchase_price * i.quantity)) / SUM(i.estimated_sale_price * i.quantity)
            ELSE 0 END as expected_profit_margin
FROM calculator_sessions s
LEFT JOIN calculator_items i ON i.session_id = s.session_id
WHERE s.session_id = @session_id
GROUP BY s.session_id, s.session_name, s.asking_price, s.status, s.created_at, s.updated_at;

-- Session items with product details
SELECT i.*,
       cp.title as product_title,
       vt.code as variant_type_code,
       vt.display_name as variant_display_name,
       p.short_name as platform_short,
       p.video_game_manual_sensitive as platform_manual_sensitive
FROM calculator_items i
JOIN CatalogProducts cp ON cp.catalog_product_id = i.catalog_product_id
JOIN ListingVariants lv ON lv.variant_id = i.variant_id  
JOIN VariantTypes vt ON vt.variant_type_id = lv.variant_type_id
LEFT JOIN CatalogProductGames cpg ON cpg.catalog_product_id = i.catalog_product_id
LEFT JOIN Platforms p ON p.platform_id = cpg.platform_id
WHERE i.session_id = @session_id
ORDER BY i.created_at;
```

#### Session Summary Statistics
```sql
SELECT 
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_sessions,
    COUNT(CASE WHEN status = 'finalized' THEN 1 END) as finalized_sessions,
    COUNT(CASE WHEN status = 'converted_to_po' THEN 1 END) as converted_sessions,
    AVG(asking_price) as avg_asking_price,
    SUM(total_estimated_revenue) as total_pipeline_revenue
FROM calculator_sessions
WHERE created_at >= DATEADD(month, -1, GETDATE());
```

#### Deduction Analysis  
```sql
SELECT 
    p.short_name as platform,
    p.video_game_manual_sensitive,
    COUNT(*) as total_items,
    COUNT(CASE WHEN i.has_manual = 0 THEN 1 END) as items_missing_manual,
    AVG(i.deductions) as avg_deductions,
    SUM(i.deductions) as total_deductions
FROM calculator_items i
JOIN ListingVariants lv ON lv.variant_id = i.variant_id
JOIN CatalogProductGames cpg ON cpg.catalog_product_id = lv.catalog_product_id  
JOIN Platforms p ON p.platform_id = cpg.platform_id
JOIN VariantTypes vt ON vt.variant_type_id = lv.variant_type_id
WHERE vt.code = 'CIB'
  AND i.deductions > 0
GROUP BY p.short_name, p.video_game_manual_sensitive
ORDER BY total_deductions DESC;
```

### Performance Indexes

#### Query Performance Optimization
```sql
-- Session listing performance
CREATE INDEX IX_calculator_sessions_status_created_at 
ON calculator_sessions(status, created_at DESC);

-- Item lookup performance
CREATE INDEX IX_calculator_items_session_variant 
ON calculator_items(session_id, variant_id);

-- Platform sensitivity lookups
CREATE INDEX IX_platforms_manual_sensitive 
ON Platforms(video_game_manual_sensitive) 
WHERE video_game_manual_sensitive = 1;

-- Catalog integration performance
CREATE INDEX IX_calculator_items_catalog_created 
ON calculator_items(catalog_product_id, created_at DESC);
```

## Data Migration Scripts

### Initial Calculator Tables
```sql
-- Create calculator_sessions table
CREATE TABLE calculator_sessions (
    session_id INT IDENTITY(1,1) PRIMARY KEY,
    session_name NVARCHAR(255) NOT NULL,
    asking_price DECIMAL(10,2) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- Create calculator_items table  
CREATE TABLE calculator_items (
    item_id INT IDENTITY(1,1) PRIMARY KEY,
    session_id INT NOT NULL,
    catalog_product_id INT NOT NULL,
    variant_id INT NOT NULL,
    estimated_sale_price DECIMAL(10,2) NOT NULL,
    purchase_price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    custom_deductions DECIMAL(10,2) NULL DEFAULT 0,
    deductions DECIMAL(10,2) NULL DEFAULT 0,
    deduction_reasons NVARCHAR(500) NULL,
    has_manual BIT NULL,
    notes NVARCHAR(1000) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    
    FOREIGN KEY (session_id) REFERENCES calculator_sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (catalog_product_id) REFERENCES CatalogProducts(catalog_product_id),
    FOREIGN KEY (variant_id) REFERENCES ListingVariants(variant_id)
);
```

### Add Platform Manual Sensitivity
```sql
-- Migration: 2025-08-31_0007_add_platform_manual_sensitivity.sql
ALTER TABLE Platforms 
ADD video_game_manual_sensitive BIT NOT NULL DEFAULT 0;

UPDATE Platforms 
SET video_game_manual_sensitive = 1
WHERE short_name IN ('PS2', 'PS3', 'Xbox', '360', 'GC', 'Wii');

-- Verify the update
SELECT platform_id, name, short_name, video_game_manual_sensitive 
FROM Platforms 
WHERE video_game_manual_sensitive = 1
ORDER BY name;
```

## Backup & Recovery

### Critical Data Backup
```sql
-- Backup calculator data
SELECT s.*, i.*
FROM calculator_sessions s
LEFT JOIN calculator_items i ON i.session_id = s.session_id
ORDER BY s.created_at DESC, i.created_at;

-- Backup platform configuration
SELECT platform_id, name, short_name, video_game_manual_sensitive
FROM Platforms
WHERE video_game_manual_sensitive = 1;
```

### Data Validation Queries
```sql
-- Check data integrity
SELECT 'Orphaned Items' as check_type, COUNT(*) as count
FROM calculator_items i
LEFT JOIN calculator_sessions s ON s.session_id = i.session_id
WHERE s.session_id IS NULL

UNION ALL

SELECT 'Invalid Product References' as check_type, COUNT(*) as count  
FROM calculator_items i
LEFT JOIN CatalogProducts cp ON cp.catalog_product_id = i.catalog_product_id
WHERE cp.catalog_product_id IS NULL

UNION ALL

SELECT 'Invalid Variant References' as check_type, COUNT(*) as count
FROM calculator_items i  
LEFT JOIN ListingVariants lv ON lv.variant_id = i.variant_id
WHERE lv.variant_id IS NULL;
```
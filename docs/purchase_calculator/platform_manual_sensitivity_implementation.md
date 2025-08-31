# Platform Manual Sensitivity Implementation

## Overview for Humans

### What This Feature Does
The platform manual sensitivity system distinguishes between gaming platforms based on whether physical manuals were commonly included and impact the "Complete in Box" (CIB) pricing:

- **Manual-Sensitive Platforms** (PS2, PS3, Xbox, Xbox 360, GameCube, Wii): These platforms typically included physical manuals that collectors expect for true CIB condition. Missing manuals result in automatic price deductions.

- **Non-Manual-Sensitive Platforms** (PS5, PS4, etc.): These platforms either didn't commonly include manuals or the manuals don't significantly impact CIB pricing. Users can still track manual status, but it won't affect purchase price calculations.

### User Experience
- **PS3 CIB Item**: Shows yellow warning box, defaults to "has manual = true", applies deductions if manual is missing
- **PS5 CIB Item**: Shows blue informational box, defaults to "has manual = false", no price impact regardless of manual status

### Business Impact
This ensures accurate purchase price calculations by only applying manual-related deductions to platforms where it actually affects market value, leading to more precise profit margin calculations.

---

## Technical Implementation Reference

### Database Schema
```sql
-- Platforms table enhancement
ALTER TABLE dbo.Platforms 
ADD video_game_manual_sensitive BIT NOT NULL DEFAULT 0;

-- Manual-sensitive platforms
UPDATE dbo.Platforms 
SET video_game_manual_sensitive = 1
WHERE short_name IN ('PS2', 'PS3', 'Xbox', '360', 'GC', 'Wii');
```

### Backend Data Flow

#### 1. Repository Layer (`catalog_repo.py`)
**Method**: `variants_for_products()`
```python
SELECT v.variant_id, v.catalog_product_id, v.variant_type_id, vt.code AS variant_type_code,
       vt.display_name, v.current_market_value, v.default_list_price, v.updated_at,
       p.short_name AS platform_short, p.video_game_manual_sensitive AS platform_manual_sensitive
FROM dbo.ListingVariants v
JOIN dbo.VariantTypes vt ON vt.variant_type_id = v.variant_type_id
LEFT JOIN dbo.CatalogProductGames cpg ON cpg.catalog_product_id = v.catalog_product_id
LEFT JOIN dbo.Platforms p ON p.platform_id = cpg.platform_id
WHERE v.is_active = 1 AND v.catalog_product_id IN (...)
```

#### 2. Service Layer (`catalog_services.py`)
**Method**: `search()`
```python
# Key fix: Include platform fields in variant response
for v in variants_by_product.get(r["catalog_product_id"], []):
    vlist.append({
        "variant_id": v["variant_id"],
        "variant_type_id": v["variant_type_id"],
        "variant_type_code": v["variant_type_code"],
        "display_name": v["display_name"],
        "current_market_value": float(v["current_market_value"]) if v["current_market_value"] is not None else None,
        "default_list_price": float(v["default_list_price"]) if v["default_list_price"] is not None else None,
        "platform_short": v.get("platform_short"),          # ADDED
        "platform_manual_sensitive": v.get("platform_manual_sensitive"),  # ADDED
    })
```

#### 3. Pydantic Schema (`schemas/catalog.py`)
```python
class CatalogSearchResponseItemVariant(BaseModel):
    variant_id: int
    variant_type_id: int
    variant_type_code: str
    display_name: str
    current_market_value: Optional[float] = None
    default_list_price: Optional[float] = None
    platform_short: Optional[str] = None              # ADDED
    platform_manual_sensitive: Optional[bool] = None  # ADDED
```

### Frontend Implementation

#### 1. TypeScript Types (`types/api.ts`)
```typescript
export interface ProductVariant {
  variant_id: number;
  variant_type_id: number;
  variant_type_code: string;
  display_name: string;
  current_market_value?: number;
  default_list_price?: number;
  platform_short?: string;              // ADDED
  platform_manual_sensitive?: boolean;  // ADDED
}
```

#### 2. Component Logic (`CalculatorPricingPanel.tsx`)
```typescript
// Platform sensitivity check
const isPlatformManualSensitive = selectedVariant?.platform_manual_sensitive === true;

// Default hasManual based on platform
React.useEffect(() => {
  if (selectedVariant?.variant_type_code === 'CIB') {
    setHasManual(isPlatformManualSensitive);
  }
}, [selectedVariant?.variant_type_code, isPlatformManualSensitive]);

// Conditional deduction logic
if (isCIB && isPlatformManualSensitive && !hasManual && customDeductionAmount === 0) {
  deductions = markup; // Apply automatic deduction
}

// Visual styling based on platform
const sectionStyle = {
  background: isPlatformManualSensitive ? '#fff3cd' : '#d1ecf1', // Yellow vs Blue
  // ...
};
```

### API Endpoints Used

#### GET `/api/v1/catalog/search`
**Purpose**: Search for catalog products with variants
**Response**: Includes platform sensitivity data in variant objects
**Key Fields**: `platform_short`, `platform_manual_sensitive`

#### GET `/api/v1/calculator/sessions/{id}`
**Purpose**: Load calculator session data
**Usage**: Load existing sessions with line items

#### POST `/api/v1/calculator/sessions/{id}/items`
**Purpose**: Add items to calculator session
**Payload**: Includes deduction fields
```json
{
  "catalog_product_id": 114,
  "variant_id": 263,
  "estimated_sale_price": 86.34,
  "purchase_price": 25.90,
  "quantity": 1,
  "deductions": 15.00,
  "deduction_reasons": "Missing manual",
  "has_manual": false
}
```

### Database Storage

#### purchase_calculator_items table
- `deductions` (DECIMAL): Monetary deduction amount
- `deduction_reasons` (NVARCHAR): Reason for deduction
- `has_manual` (BIT): Manual inclusion status

### Key Files Modified
1. `backend/app/repositories/catalog_repo.py` - Added platform joins
2. `backend/app/services/catalog_services.py` - Include platform fields in response
3. `backend/app/schemas/catalog.py` - Added platform fields to Pydantic model
4. `frontend/src/types/api.ts` - Added platform fields to TypeScript interface
5. `frontend/src/components/CalculatorPricingPanel.tsx` - Platform-aware UI logic

### Testing Scenarios
1. **PS3 Game**: Should show yellow box, default hasManual=true, apply deductions when hasManual=false
2. **PS5 Game**: Should show blue box, default hasManual=false, no deductions regardless of manual status
3. **Data Flow**: Verify platform data flows from DB → API → Frontend without loss

### Common Issues & Solutions
- **Platform data missing**: Check service layer includes platform fields in variant response
- **Wrong default hasManual**: Verify platform_manual_sensitive value in database
- **UI not updating**: Ensure frontend receives platform data and isPlatformManualSensitive calculation is correct
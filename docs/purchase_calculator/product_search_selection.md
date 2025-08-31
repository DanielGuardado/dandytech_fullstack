# Product Search & Selection

[← Back to Purchase Calculator Documentation](./README.md)

## Overview for Humans

The product search and selection system allows users to find gaming products from the catalog, select the appropriate condition/variant, and add them to calculator sessions. It handles the complete workflow from search to pricing calculation.

### Key Features
- **Smart Search**: Finds products by title with platform detection (e.g., "Spider-Man PS3")
- **Product Creation**: Create new catalog entries if products don't exist
- **Variant Selection**: Choose condition (NEW, CIB, Loose, etc.) with current market values
- **PriceCharting Integration**: Link products to market pricing data
- **Platform Detection**: Automatic platform identification from search queries

### User Experience
1. **Search**: Type product name, system suggests matches
2. **Select Product**: Choose from search results or create new
3. **Link Pricing**: Connect to PriceCharting for market values (if needed)
4. **Choose Variant**: Select condition (CIB, Loose, etc.) with current pricing
5. **Calculate**: System shows optimal purchase price based on fees and margins

---

## Technical Implementation

### Frontend Component Flow

#### AddLineItemFlow.tsx - Main Orchestrator
```typescript
type FlowStep = 'search' | 'create-product' | 'pc-link' | 'select-variant' | 'create-variant' | 'calculator-pricing';

const AddLineItemFlow: React.FC<AddLineItemFlowProps> = ({
  mode = 'calculator', // or 'purchase_order'
  onAddCalculatorItem,
  // ...
}) => {
  const [currentStep, setCurrentStep] = useState<FlowStep>('search');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [availableVariants, setAvailableVariants] = useState<ProductVariant[]>([]);
  // ...
}
```

#### Step Progression Logic
```typescript
const handleProductSelected = (product: Product) => {
  setSelectedProduct(product);
  setAvailableVariants(product.variants);
  
  if (product.variants.length > 0) {
    setCurrentStep('select-variant'); // Go directly to variant selection
  } else {
    setCurrentStep('pc-link'); // Need to create variants via PriceCharting
  }
};

const handleVariantSelected = (variant: ProductVariant) => {
  if (mode === 'calculator') {
    setSelectedVariantForCalculator(variant);
    setCurrentStep('calculator-pricing'); // Final step for calculator
  } else {
    // Handle purchase order mode
    onAddItem?.(lineItemData, allocationData);
  }
};
```

### Search Implementation

#### ProductSearch.tsx Component
```typescript
interface ProductSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onProductSelected: (product: Product) => void;
  onCreateProduct: () => void;
  platforms: Platform[];
  loading: boolean;
}

// Smart search with debouncing
const [searchResults, setSearchResults] = useState<Product[]>([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  const searchProducts = async () => {
    if (query.trim().length < 2) return;
    
    setLoading(true);
    try {
      const response = await catalogService.searchProducts(query);
      setSearchResults(response.items);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const debounceTimer = setTimeout(searchProducts, 300);
  return () => clearTimeout(debounceTimer);
}, [query]);
```

#### Platform Detection
```typescript
// In utils/platformExtractor.ts
export const extractPlatformFromQuery = (query: string): {
  cleanQuery: string;
  detectedPlatform: Platform | null;
} => {
  const platforms = ['PS5', 'PS4', 'PS3', 'PS2', 'Xbox', '360', 'Switch', 'Wii'];
  const lowerQuery = query.toLowerCase();
  
  for (const platform of platforms) {
    if (lowerQuery.includes(platform.toLowerCase())) {
      const cleanQuery = query.replace(new RegExp(platform, 'gi'), '').trim();
      return { cleanQuery, detectedPlatform: findPlatformByName(platform) };
    }
  }
  
  return { cleanQuery: query, detectedPlatform: null };
};
```

### Backend Search Service

#### CatalogService.search() Method
```python
def search(self, *, q: Optional[str], upc: Optional[str],
           category_id: Optional[int], platform_id: Optional[int],
           limit: int, offset: int) -> dict:
    
    # Platform inference from query
    q_text = q
    inferred_pid = None
    if not platform_id and q:
        q_text, token = extract_platform_hint(q)
        if token:
            inferred_pid = self.repo.platform_id_from_token(token)
    
    final_platform_id = platform_id or inferred_pid
    
    # Search with platform context
    rows = self.repo.search_catalog_page(
        q_text=q_text, 
        platform_id=final_platform_id,
        limit=limit, 
        offset=offset
    )
    
    # Get variants with platform sensitivity data
    variants_by_product = self.repo.variants_for_products(product_ids)
    
    # Build response with complete variant data
    items = []
    for r in rows:
        vlist = []
        for v in variants_by_product.get(r["catalog_product_id"], []):
            vlist.append({
                "variant_id": v["variant_id"],
                "variant_type_code": v["variant_type_code"],
                "display_name": v["display_name"],
                "current_market_value": float(v["current_market_value"]) if v["current_market_value"] else None,
                "platform_short": v.get("platform_short"),
                "platform_manual_sensitive": v.get("platform_manual_sensitive"),
            })
```

### Product Creation Flow

#### CreateProductPanel.tsx
```typescript
interface CreateProductRequest {
  category_id: number;
  title: string;
  brand?: string;
  upc?: string;
  release_year?: number;
  game?: {
    platform_id: number;
  };
  console?: {
    model_number: string;
    storage_capacity_gb?: number;
  };
}

const handleCreateProduct = async (productData: CreateProductRequest) => {
  try {
    const response = await catalogService.createProduct(productData);
    setCreatedProductId(response.catalog_product_id);
    setCurrentStep('pc-link'); // Move to PriceCharting linking
  } catch (error) {
    setError(`Failed to create product: ${error}`);
  }
};
```

#### Validation Rules
```typescript
const validateProductData = (data: CreateProductRequest): string[] => {
  const errors: string[] = [];
  
  if (!data.title?.trim()) {
    errors.push('Title is required');
  }
  
  if (!data.category_id) {
    errors.push('Category is required');
  }
  
  // Category-specific validation
  if (data.category_id === CATEGORY_VIDEO_GAME && !data.game?.platform_id) {
    errors.push('Platform is required for video games');
  }
  
  return errors;
};
```

### Variant Selection

#### VariantSelectPanel.tsx
```typescript
interface VariantSelectProps {
  availableVariants: ProductVariant[];
  onVariantSelected: (variant: ProductVariant, allocation: AllocationDetails | null) => void;
  defaultVariantMode: string; // 'CIB', 'LOOSE', etc.
  mode: 'purchase_order' | 'calculator';
}

// Auto-highlight default variant type
useEffect(() => {
  const defaultVariant = availableVariants.find(v => 
    v.variant_type_code === defaultVariantMode
  );
  if (defaultVariant) {
    setHighlightedVariant(defaultVariant);
  }
}, [availableVariants, defaultVariantMode]);

// Variant selection with allocation calculation
const handleVariantClick = (variant: ProductVariant) => {
  if (mode === 'calculator') {
    onVariantSelected(variant, null); // No allocation needed for calculator
  } else {
    // Calculate allocation for purchase orders
    const allocation = calculateAllocation(variant, currentLineItems);
    onVariantSelected(variant, allocation);
  }
};
```

### PriceCharting Integration

#### PriceChartingPanel.tsx
```typescript
interface PriceChartingResult {
  pricecharting_id: string;
  product_name: string;
  console_name: string;
  cib_price?: number;
  loose_price?: number;
  new_price?: number;
}

const searchPriceCharting = async (query: string) => {
  setSearching(true);
  try {
    const response = await catalogService.searchPriceCharting(
      productId, 
      query, 
      upc, 
      platform?.short_name
    );
    setPriceChartingResults(response.results);
  } finally {
    setSearching(false);
  }
};

const linkToPriceCharting = async (priceChartingId: string) => {
  try {
    await catalogService.linkToPriceCharting(productId, priceChartingId);
    // Refresh to get newly created variants
    window.location.reload(); // Simple refresh for now
  } catch (error) {
    setError(`Failed to link: ${error}`);
  }
};
```

### Data Flow Diagram

```
1. User Search
   ├── Frontend: ProductSearch.tsx
   ├── API: GET /catalog/search?q=spider-man+ps3
   ├── Backend: CatalogService.search()
   ├── Database: Product + Variant queries with platform data
   └── Response: Products with variants including platform_manual_sensitive

2. Product Selection  
   ├── User clicks product from results
   ├── Frontend: AddLineItemFlow.handleProductSelected()
   ├── Check: Does product have variants?
   ├── Yes → VariantSelectPanel
   └── No → PriceChartingPanel

3. Variant Selection
   ├── User selects CIB variant
   ├── Frontend: VariantSelectPanel.handleVariantClick()
   ├── Mode check: calculator vs purchase_order
   ├── Calculator → CalculatorPricingPanel
   └── Purchase Order → Create line item immediately

4. Pricing Calculation
   ├── CalculatorPricingPanel receives variant with platform data
   ├── Platform sensitivity check: isPlatformManualSensitive
   ├── Fee calculations with deductions
   ├── User confirms → Add to session
   └── API: POST /calculator/sessions/{id}/items
```

### Error Handling Patterns

#### Network Failures
```typescript
const handleSearchError = (error: Error) => {
  if (error.message.includes('network')) {
    setError('Connection failed. Check internet and try again.');
  } else if (error.message.includes('404')) {
    setError('No products found. Try a different search term.');
  } else {
    setError(`Search failed: ${error.message}`);
  }
};
```

#### Validation Errors
```typescript
const validateSelection = (variant: ProductVariant): string | null => {
  if (!variant.current_market_value) {
    return 'This variant has no market value data. Cannot calculate pricing.';
  }
  
  if (variant.current_market_value < 5) {
    return 'Market value too low for profitable resale.';
  }
  
  return null; // Valid
};
```

### Performance Optimizations

#### Search Debouncing
- 300ms delay before API calls
- Cancel previous requests when new ones start
- Cache recent search results

#### Lazy Loading
- Load variant details only when product selected
- Defer PriceCharting searches until needed
- Progressive disclosure of complex forms
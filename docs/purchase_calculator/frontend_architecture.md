# Frontend Architecture

[← Back to Purchase Calculator Documentation](./README.md)

## Overview for Humans

The purchase calculator frontend is built with React TypeScript using a component-based architecture. It features a 3-panel desktop layout optimized for keyboard navigation and bulk operations, following the design principles outlined in the CLAUDE.md guidelines.

### Key Design Principles
- **Desktop-First**: Full screen utilization with keyboard navigation
- **Multi-Panel Layout**: Session details + item table + add item flow
- **Real-Time Calculations**: Instant feedback on pricing changes
- **Spreadsheet-Like Interactions**: Inline editing and bulk operations
- **Platform-Aware UI**: Visual distinctions based on manual sensitivity

---

## Component Architecture

### Main Container - PurchaseCalculator.tsx
**Purpose**: Root component managing the 3-panel layout and state coordination

#### State Management
```typescript
const PurchaseCalculator: React.FC = () => {
  // Session Management
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [dynamicSessionData, setDynamicSessionData] = useState<SessionDetails | null>(null);
  
  // UI State
  const [showAddItemFlow, setShowAddItemFlow] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reference Data
  const [config, setConfig] = useState<Record<string, CalculatorConfig>>({});
  const [lookups, setLookups] = useState<LookupData | null>(null);
};
```

#### Layout Structure
```typescript
return (
  <div className="purchase-calculator">
    {/* Header with session selector and status */}
    <div className="header-section">
      <SessionSelector />
      <StatusIndicator />
    </div>
    
    {/* 3-Panel Layout */}
    <div className="main-content">
      {/* Left Panel - Session Details & Config */}
      <div className="left-panel">
        <SessionDetailsPanel />
        {showConfigPanel && <ConfigurationPanel />}
      </div>
      
      {/* Middle Panel - Items Table */}
      <div className="middle-panel">
        <SessionItemsTable />
      </div>
      
      {/* Right Panel - Add Item Flow (conditional) */}
      {showAddItemFlow && (
        <div className="right-panel">
          <AddLineItemFlow />
        </div>
      )}
    </div>
  </div>
);
```

### Session Items Table - SessionItemsTable.tsx
**Purpose**: Bulk item management with inline editing capabilities

#### Features
- Sortable columns (price, margin, date)
- Inline editing for purchase prices and quantities
- Bulk operations (delete multiple items)
- Real-time profit margin calculations
- Platform sensitivity visual indicators

```typescript
const SessionItemsTable: React.FC<SessionItemsTableProps> = ({
  items,
  onUpdateItem,
  onDeleteItem,
  loading
}) => {
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{[key: number]: Partial<SessionItem>}>({});
  
  const handleInlineEdit = (itemId: number, field: string, value: any) => {
    setEditValues(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value }
    }));
  };
  
  const handleSaveEdit = async (itemId: number) => {
    const updates = editValues[itemId];
    if (updates) {
      await onUpdateItem(itemId, updates);
      setEditingItem(null);
      setEditValues(prev => {
        const { [itemId]: removed, ...rest } = prev;
        return rest;
      });
    }
  };
};
```

### Add Item Flow - AddLineItemFlow.tsx  
**Purpose**: Multi-step wizard for product selection and pricing

#### Flow Steps
```typescript
type FlowStep = 'search' | 'create-product' | 'pc-link' | 'select-variant' | 'create-variant' | 'calculator-pricing';

const stepProgression = {
  search: (hasResults: boolean) => hasResults ? 'select-variant' : 'create-product',
  'create-product': () => 'pc-link',
  'pc-link': (hasVariants: boolean) => hasVariants ? 'select-variant' : 'create-variant',
  'select-variant': (mode: string) => mode === 'calculator' ? 'calculator-pricing' : 'complete',
  'calculator-pricing': () => 'complete'
};
```

#### State Flow Management
```typescript
const [currentStep, setCurrentStep] = useState<FlowStep>('search');
const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
const [selectedVariantForCalculator, setSelectedVariantForCalculator] = useState<ProductVariant | null>(null);

// Step navigation logic
const handleProductSelected = (product: Product) => {
  setSelectedProduct(product);
  setAvailableVariants(product.variants);
  
  if (product.variants.length > 0) {
    setCurrentStep('select-variant');
  } else {
    setCurrentStep('pc-link'); // Need to create variants
  }
};

const handleVariantSelected = (variant: ProductVariant) => {
  if (mode === 'calculator') {
    setSelectedVariantForCalculator(variant);
    setCurrentStep('calculator-pricing');
  } else {
    // Handle purchase order mode
    onAddItem?.(createLineItem(variant), calculateAllocation(variant));
  }
};
```

### Pricing Panel - CalculatorPricingPanel.tsx
**Purpose**: Core pricing calculations with platform-aware logic

#### Platform Sensitivity Integration
```typescript
const CalculatorPricingPanel: React.FC<Props> = ({ selectedVariant, config, onAddItem }) => {
  // Platform sensitivity detection
  const isPlatformManualSensitive = selectedVariant?.platform_manual_sensitive === true;
  
  // State management
  const [estimatedSalePrice, setEstimatedSalePrice] = useState<number>(selectedVariant?.current_market_value || 0);
  const [hasManual, setHasManual] = useState<boolean>(isPlatformManualSensitive);
  const [customDeductions, setCustomDeductions] = useState<string>('');
  
  // Real-time calculations
  const calculations = useMemo(() => {
    return calculateOptimalPurchasePrice(
      estimatedSalePrice,
      isPlatformManualSensitive,
      hasManual,
      parseFloat(customDeductions) || 0,
      config
    );
  }, [estimatedSalePrice, isPlatformManualSensitive, hasManual, customDeductions, config]);
};
```

#### Visual Platform Differentiation
```typescript
// Platform-specific styling
const sectionStyle = {
  background: isPlatformManualSensitive ? '#fff3cd' : '#d1ecf1', // Yellow vs Blue
  border: `1px solid ${isPlatformManualSensitive ? '#ffeaa7' : '#bee5eb'}`,
  borderRadius: '4px',
  padding: '12px',
  marginBottom: '12px'
};

// Platform-specific messaging
const getPlatformMessage = () => {
  if (isPlatformManualSensitive) {
    return `⚠️ ${selectedVariant.platform_short} CIB items typically include manuals. Missing manuals reduce value.`;
  } else {
    return `📋 ${selectedVariant.platform_short} CIB tracking: Manual status noted but doesn't impact pricing.`;
  }
};
```

## State Management Patterns

### Component State Distribution
```typescript
// Global State (PurchaseCalculator)
- sessions: SessionSummary[]
- selectedSessionId: number | null  
- config: CalculatorConfig
- lookups: LookupData

// Session State (dynamically loaded)
- sessionDetails: SessionDetails
- sessionItems: SessionItem[]

// Flow State (AddLineItemFlow)
- currentStep: FlowStep
- selectedProduct: Product | null
- availableVariants: ProductVariant[]

// Calculation State (CalculatorPricingPanel)  
- estimatedSalePrice: number
- hasManual: boolean
- customDeductions: string
- calculations: PricingCalculation | null
```

### Data Flow Patterns
```typescript
// Top-down data flow
PurchaseCalculator 
  ├── passes config & lookups to AddLineItemFlow
  ├── passes sessionData to SessionItemsTable  
  └── receives item updates from both components

// Event bubbling for state updates
AddLineItemFlow.onAddItem(item) 
  → PurchaseCalculator.handleAddItem(item)
  → API call to add item
  → Refresh session data
  → Update SessionItemsTable

// Real-time calculation updates
CalculatorPricingPanel input change
  → useMemo recalculation
  → Immediate UI update
  → Debounced API save (optional)
```

### Error Boundary Implementation
```typescript
class CalculatorErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Calculator Error:', error, errorInfo);
    // Log to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h3>Something went wrong with the calculator</h3>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Service Layer Integration

### API Service Classes
```typescript
// calculatorService.ts
class CalculatorService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`/api/v1${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async getSessions(limit = 50, offset = 0): Promise<SessionListResponse> {
    return this.request<SessionListResponse>(`/calculator/sessions?limit=${limit}&offset=${offset}`);
  }

  async getSession(sessionId: number): Promise<SessionDetails> {
    return this.request<SessionDetails>(`/calculator/sessions/${sessionId}`);
  }

  async addItemToSession(sessionId: number, item: CalculatorItemCreate): Promise<SessionItem> {
    return this.request<SessionItem>(`/calculator/sessions/${sessionId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }
}

// catalogService.ts  
class CatalogService {
  async searchProducts(query: string, platform?: string): Promise<CatalogSearchResponse> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (platform) params.append('platform', platform);
    
    return this.request<CatalogSearchResponse>(`/catalog/search?${params}`);
  }
}
```

### Custom Hooks for Data Management
```typescript
// hooks/useCalculatorSession.ts
export const useCalculatorSession = (sessionId: number | null) => {
  const [sessionData, setSessionData] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const data = await calculatorService.getSession(sessionId);
      setSessionData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const addItem = useCallback(async (item: CalculatorItemCreate) => {
    if (!sessionId) return;
    
    try {
      await calculatorService.addItemToSession(sessionId, item);
      await refreshSession(); // Refresh to get updated totals
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    }
  }, [sessionId, refreshSession]);

  return { sessionData, loading, error, refreshSession, addItem };
};
```

## Performance Optimization

### Memoization Strategies
```typescript
// Expensive calculation memoization
const calculations = useMemo(() => {
  if (!estimatedSalePrice || !config) return null;
  
  return calculateOptimalPurchasePrice(
    estimatedSalePrice,
    isPlatformManualSensitive, 
    hasManual,
    customDeductionAmount,
    config
  );
}, [estimatedSalePrice, isPlatformManualSensitive, hasManual, customDeductionAmount, config]);

// Component memoization for expensive renders
const SessionItemRow = React.memo<SessionItemRowProps>(({ item, onUpdate, onDelete }) => {
  return (
    <tr className="session-item-row">
      {/* ... row content ... */}
    </tr>
  );
});
```

### Debouncing for Real-Time Updates
```typescript
// Debounced API saves
const [debouncedSave] = useMemo(() => {
  return [
    debounce((itemId: number, updates: Partial<SessionItem>) => {
      onUpdateItem(itemId, updates);
    }, 1000)
  ];
}, [onUpdateItem]);

// Auto-save on changes
useEffect(() => {
  if (editValues[itemId]) {
    debouncedSave(itemId, editValues[itemId]);
  }
}, [editValues, itemId, debouncedSave]);
```

### Virtual Scrolling for Large Lists
```typescript
// For sessions with many items (100+)
const SessionItemsVirtualTable: React.FC = ({ items, ...props }) => {
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  
  const virtualizer = useVirtual({
    size: items.length,
    parentRef: containerRef,
    estimateSize: useCallback(() => 45, []), // Row height
    overscan: 10
  });

  return (
    <div ref={setContainerRef} className="virtual-table-container">
      <div style={{ height: virtualizer.totalSize }}>
        {virtualizer.virtualItems.map(virtualRow => {
          const item = items[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: virtualRow.start,
                left: 0,
                width: '100%',
                height: virtualRow.size,
              }}
            >
              <SessionItemRow item={item} {...props} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

## Responsive Design Considerations

### Panel Collapse Logic
```typescript
const [panelSizes, setPanelSizes] = useState({
  left: showAddItemFlow ? 280 : 320,  // Shrink when flow opens
  middle: 'flex-1',                   // Takes remaining space
  right: showAddItemFlow ? 400 : 0    // Conditional visibility
});

// Dynamic width adjustments
const leftPanelStyle = {
  width: panelSizes.left,
  transition: 'width 0.2s ease-in-out'
};
```

### Keyboard Navigation
```typescript
// Spreadsheet-like navigation
const handleKeyDown = (e: KeyboardEvent, rowIndex: number, colIndex: number) => {
  switch (e.key) {
    case 'ArrowDown':
      focusCell(rowIndex + 1, colIndex);
      break;
    case 'ArrowUp':
      focusCell(rowIndex - 1, colIndex);
      break;
    case 'Tab':
      focusCell(rowIndex, colIndex + (e.shiftKey ? -1 : 1));
      break;
    case 'Enter':
      if (editingCell === `${rowIndex}-${colIndex}`) {
        saveEdit(rowIndex, colIndex);
      } else {
        startEdit(rowIndex, colIndex);
      }
      break;
  }
};
```

## Testing Patterns

### Component Testing
```typescript
// SessionItemsTable.test.tsx
describe('SessionItemsTable', () => {
  const mockItems = [
    {
      item_id: 1,
      product_title: 'Spider-Man PS3',
      variant_type_code: 'CIB',
      estimated_sale_price: 86.34,
      purchase_price: 25.90,
      platform_manual_sensitive: true,
      has_manual: false
    }
  ];

  it('displays platform-sensitive items with yellow background', () => {
    render(<SessionItemsTable items={mockItems} />);
    
    const row = screen.getByText('Spider-Man PS3').closest('tr');
    expect(row).toHaveStyle('background-color: #fff3cd');
  });

  it('handles inline editing of purchase prices', async () => {
    const onUpdateItem = jest.fn();
    render(<SessionItemsTable items={mockItems} onUpdateItem={onUpdateItem} />);
    
    const priceCell = screen.getByDisplayValue('25.90');
    fireEvent.doubleClick(priceCell);
    fireEvent.change(priceCell, { target: { value: '30.00' } });
    fireEvent.keyDown(priceCell, { key: 'Enter' });
    
    await waitFor(() => {
      expect(onUpdateItem).toHaveBeenCalledWith(1, { purchase_price: 30.00 });
    });
  });
});
```

### Integration Testing
```typescript
// PurchaseCalculator.integration.test.tsx  
describe('Purchase Calculator Integration', () => {
  beforeEach(() => {
    // Mock API responses
    jest.spyOn(calculatorService, 'getSessions').mockResolvedValue({
      items: [{ session_id: 1, session_name: 'Test Session' }],
      total: 1
    });
  });

  it('completes full add item workflow', async () => {
    render(<PurchaseCalculator />);
    
    // Select session
    fireEvent.change(screen.getByLabelText('Session'), { target: { value: '1' } });
    
    // Open add item flow
    fireEvent.click(screen.getByText('+ Add Item'));
    
    // Search for product
    fireEvent.change(screen.getByPlaceholderText('Search products...'), { 
      target: { value: 'spider-man ps3' } 
    });
    
    // Select product and variant
    await waitFor(() => screen.getByText('Spider-Man: Shattered Dimensions'));
    fireEvent.click(screen.getByText('Spider-Man: Shattered Dimensions'));
    fireEvent.click(screen.getByText('Complete in Box'));
    
    // Configure pricing
    fireEvent.change(screen.getByLabelText('Includes Manual'), { target: { checked: false } });
    fireEvent.click(screen.getByText('Add to Session'));
    
    // Verify item added
    await waitFor(() => {
      expect(screen.getByText('Spider-Man: Shattered Dimensions')).toBeInTheDocument();
    });
  });
});
```
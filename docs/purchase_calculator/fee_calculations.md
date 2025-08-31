# Fee Calculations & Profit Analysis

[← Back to Purchase Calculator Documentation](./README.md)

## Overview for Humans

The fee calculation system is the core of the purchase calculator. It models all the costs involved in selling an item online (eBay fees, shipping, taxes, supplies) and calculates the optimal purchase price to achieve target profit margins.

### Key Components
- **Market Value Analysis**: Current selling prices from PriceCharting
- **Platform Deductions**: Automatic price reductions for manual-sensitive platforms
- **Fee Modeling**: Comprehensive cost breakdown (eBay, PayPal, taxes, shipping)
- **Profit Calculation**: Net profit and margin analysis
- **Purchase Price Optimization**: Reverse calculation from target margins

### Real-World Example
**Spider-Man PS3 CIB (Missing Manual)**
- Market Value: $86.34
- Manual Deduction: -$15.00 (17.4%)
- Adjusted Sale Price: $71.34
- Total Fees: $25.89 (36.3%)
- Net After Fees: $45.45
- Target Profit (40%): $18.18
- **Recommended Purchase Price: $27.27**

---

## Technical Implementation

### Core Calculation Logic

#### CalculatorPricingPanel.tsx - Main Calculator
```typescript
const calculatePricing = useCallback(() => {
  if (!selectedVariant || !estimatedSalePrice || !config) return null;

  // 1. Apply platform-specific deductions
  let adjustedSalePrice = estimatedSalePrice;
  let deductions = 0;
  
  if (isCIB && isPlatformManualSensitive && !hasManual && customDeductionAmount === 0) {
    // Automatic deduction for missing manual on sensitive platforms
    const markup = config.target_profit_margin * estimatedSalePrice;
    deductions = markup;
    adjustedSalePrice = estimatedSalePrice - deductions;
  } else if (customDeductionAmount > 0) {
    // User-specified custom deductions
    deductions = customDeductionAmount;
    adjustedSalePrice = estimatedSalePrice - deductions;
  }

  // 2. Calculate all fees
  const calculations = performFeeCalculations(adjustedSalePrice, config);
  
  // 3. Calculate optimal purchase price
  const targetProfit = config.target_profit_margin * adjustedSalePrice;
  const calculatedPurchasePrice = calculations.netAfterFees - targetProfit;

  return { ...calculations, deductions, calculatedPurchasePrice };
}, [selectedVariant, estimatedSalePrice, hasManual, customDeductionAmount, config]);
```

#### Fee Calculation Breakdown
```typescript
const performFeeCalculations = (salePrice: number, config: CalculatorConfig) => {
  // 1. Sales Tax (collected but not kept)
  const salesTax = salePrice * config.sales_tax_rate;
  const finalValue = salePrice - salesTax; // Net to seller before fees

  // 2. eBay Final Value Fee (percentage of total sale price including tax)
  const baseVariableFee = salePrice * config.ebay_final_value_fee;
  
  // 3. eBay Managed Payments Fee (percentage of final value)
  const transactionFee = finalValue * config.ebay_managed_payments_fee;

  // 4. Fixed Costs
  const adFee = config.ad_fee_per_listing || 0;
  const shippingCost = config.shipping_cost_fixed || 0;
  const suppliesCost = config.supplies_cost_per_item || 0;

  // 5. Cashback Benefits
  const regularCashback = finalValue * (config.cashback_rates?.regular || 0);
  const shippingCashback = shippingCost * (config.cashback_rates?.shipping || 0);
  const totalCashback = regularCashback + shippingCashback;

  // 6. Net Calculations
  const totalFees = baseVariableFee + transactionFee + adFee + shippingCost + suppliesCost - totalCashback;
  const netAfterFees = finalValue - totalFees;

  return {
    estimatedSalePrice: salePrice,
    salesTax,
    finalValue,
    baseVariableFee,
    transactionFee,
    adFee,
    shippingCost,
    suppliesCost,
    regularCashback,
    shippingCashback,
    totalCashback,
    totalFees,
    netAfterFees
  };
};
```

### Platform-Specific Deductions

#### Manual Sensitivity Logic
```typescript
const isPlatformManualSensitive = selectedVariant?.platform_manual_sensitive === true;

// Deduction calculation for manual-sensitive platforms
if (isCIB && isPlatformManualSensitive && !hasManual) {
  // Use target profit margin as deduction amount
  // Theory: Missing manual reduces value by expected profit amount
  const markup = config.target_profit_margin * estimatedSalePrice;
  deductions = markup;
  
  // Set deduction reason for tracking
  setDeductionReason(`Missing manual (${selectedVariant.platform_short})`);
}
```

#### Platform-Specific Behavior
```typescript
// Default manual status based on platform sensitivity
React.useEffect(() => {
  if (selectedVariant?.variant_type_code === 'CIB') {
    // Manual-sensitive platforms: assume manual included (true)
    // Non-sensitive platforms: assume no manual expected (false)
    setHasManual(isPlatformManualSensitive);
  }
}, [selectedVariant?.variant_type_code, isPlatformManualSensitive]);

// Visual styling based on platform type
const sectionStyle = {
  background: isPlatformManualSensitive ? '#fff3cd' : '#d1ecf1', // Yellow vs Blue
  border: `1px solid ${isPlatformManualSensitive ? '#ffeaa7' : '#bee5eb'}`,
  borderRadius: '4px',
  padding: '12px',
  marginBottom: '12px'
};
```

### Configuration System

#### Backend Configuration (`calculator_service.py`)
```python
def get_config(self) -> dict:
    """Get calculator configuration from database or defaults"""
    return {
        # eBay Fee Structure (as of 2025)
        "ebay_final_value_fee": 0.1295,        # 12.95% of total sale price
        "ebay_managed_payments_fee": 0.029,     # 2.9% of final value
        
        # Tax Rates
        "sales_tax_rate": 0.08,                 # 8% typical state sales tax
        
        # Fixed Costs
        "shipping_cost_fixed": 5.50,            # Average shipping cost per item
        "supplies_cost_per_item": 1.25,         # Packaging materials
        "ad_fee_per_listing": 0.00,             # Optional promoted listing fee
        
        # Profit Targets
        "target_profit_margin": 0.40,           # 40% target profit margin
        
        # Cashback Benefits (credit card rewards)
        "cashback_rates": {
            "regular": 0.02,                    # 2% on purchases
            "shipping": 0.05                    # 5% on shipping supplies
        }
    }
```

#### Frontend Configuration Loading
```typescript
const [config, setConfig] = useState<Record<string, CalculatorConfig>>({});

useEffect(() => {
  const loadConfig = async () => {
    try {
      const response = await calculatorService.getConfig();
      setConfig(response);
    } catch (error) {
      console.error('Failed to load calculator config:', error);
    }
  };
  
  loadConfig();
}, []);
```

### Profit Margin Analysis

#### Margin Calculations
```typescript
// Calculate profit metrics
const profitPerItem = netAfterFees - calculatedPurchasePrice;
const profitMargin = calculatedPurchasePrice > 0 ? profitPerItem / netAfterFees : 0;

// Margin quality assessment
const getMarginQuality = (margin: number): string => {
  if (margin >= 0.50) return 'Excellent';
  if (margin >= 0.40) return 'Good';
  if (margin >= 0.30) return 'Fair';
  if (margin >= 0.20) return 'Poor';
  return 'Loss';
};

// Color coding for UI
const getMarginColor = (margin: number): string => {
  if (margin >= 0.40) return '#28a745'; // Green
  if (margin >= 0.30) return '#ffc107'; // Yellow  
  if (margin >= 0.20) return '#fd7e14'; // Orange
  return '#dc3545'; // Red
};
```

### Fee Breakdown Display

#### UI Component Structure
```typescript
// Summary bar showing key metrics
<div className="summary-bar">
  <span>Sale: {formatCurrency(calculations.estimatedSalePrice)}</span>
  <span>Fees: {formatCurrency(calculations.totalFees)}</span>
  <span>Net: {formatCurrency(calculations.netAfterFees)}</span>
  <span>Purchase: {formatCurrency(calculations.calculatedPurchasePrice)}</span>
  <span style={{ color: getMarginColor(calculations.profitMargin) }}>
    Margin: {formatPercentage(calculations.profitMargin)}
  </span>
</div>

// Detailed breakdown (expandable)
<div className="fee-details">
  <div>eBay Final Value Fee: {formatCurrency(calculations.baseVariableFee)}</div>
  <div>Transaction Fee: {formatCurrency(calculations.transactionFee)}</div>
  <div>Shipping: {formatCurrency(calculations.shippingCost)}</div>
  <div>Supplies: {formatCurrency(calculations.suppliesCost)}</div>
  <div>Cashback: -{formatCurrency(calculations.totalCashback)}</div>
</div>
```

### Custom Deductions

#### User Override System
```typescript
const [customDeductions, setCustomDeductions] = useState<string>('');

// Parse user input for custom deduction amount
const customDeductionAmount = useMemo(() => {
  const parsed = parseFloat(customDeductions);
  return isNaN(parsed) ? 0 : parsed;
}, [customDeductions]);

// Apply custom deductions instead of automatic ones
if (customDeductionAmount > 0) {
  deductions = customDeductionAmount;
  adjustedSalePrice = estimatedSalePrice - deductions;
  setDeductionReason('Custom deduction');
}
```

### Database Storage

#### Calculator Items Schema
```sql
CREATE TABLE calculator_items (
    -- ... other fields ...
    estimated_sale_price DECIMAL(10,2) NOT NULL,      -- Market value
    purchase_price DECIMAL(10,2) NOT NULL,            -- Calculated optimal price  
    custom_deductions DECIMAL(10,2) NULL DEFAULT 0,   -- User-specified deductions
    deductions DECIMAL(10,2) NULL DEFAULT 0,          -- Applied deductions (auto or custom)
    deduction_reasons NVARCHAR(500) NULL,             -- Why deductions were applied
    has_manual BIT NULL,                               -- Manual inclusion status
);
```

### Real-Time Updates

#### Reactive Calculations
```typescript
// Recalculate whenever inputs change
useEffect(() => {
  const newCalculations = calculatePricing();
  setCalculations(newCalculations);
}, [estimatedSalePrice, hasManual, customDeductions, selectedVariant, config]);

// Auto-save to backend (debounced)
useEffect(() => {
  if (!calculations) return;
  
  const saveTimer = setTimeout(() => {
    // Save current state to session
    saveItemCalculations(calculations);
  }, 1000);
  
  return () => clearTimeout(saveTimer);
}, [calculations]);
```

### Error Handling & Validation

#### Input Validation
```typescript
const validateInputs = (): string[] => {
  const errors: string[] = [];
  
  if (!estimatedSalePrice || estimatedSalePrice <= 0) {
    errors.push('Market value must be greater than 0');
  }
  
  if (customDeductionAmount >= estimatedSalePrice) {
    errors.push('Deductions cannot exceed market value');
  }
  
  if (calculations?.calculatedPurchasePrice <= 0) {
    errors.push('Purchase price too low - check fee configuration');
  }
  
  return errors;
};
```

### Performance Considerations

#### Calculation Optimization
- Use `useMemo` for expensive calculations
- Debounce API calls for real-time updates
- Cache configuration data across components
- Batch database updates for multiple items
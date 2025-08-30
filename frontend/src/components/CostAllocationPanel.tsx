import React, { useState, useEffect, useMemo } from 'react';
import { ProductVariant } from '../types/api';

interface CostAllocationPanelProps {
  variant: ProductVariant;
  currentLineItems: Array<{allocation_basis: number; quantity_expected: number; cost_assignment_method: string}>;
  onComplete: (allocationData: {
    allocation_basis: number;
    cost_assignment_method: 'manual' | 'by_market_value';
    allocation_basis_source: string;
    quantity: number;
  }) => void;
  onBack: () => void;
}

const CostAllocationPanel: React.FC<CostAllocationPanelProps> = ({
  variant,
  currentLineItems,
  onComplete,
  onBack
}) => {
  const [allocationMethod, setAllocationMethod] = useState<'manual' | 'by_market_value'>('by_market_value');
  const [allocationBasis, setAllocationBasis] = useState<string>('');
  const [useCustomValue, setUseCustomValue] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Initialize allocation basis when component mounts or variant changes
  useEffect(() => {
    console.log('CostAllocationPanel - Variant received:', {
      fullVariant: variant,
      variant_id: variant.variant_id,
      variant_type_id: variant.variant_type_id,
      variant_type_code: variant.variant_type_code,
      display_name: variant.display_name,
      current_market_value: variant.current_market_value,
      default_list_price: variant.default_list_price,
      allocationMethod,
      useCustomValue,
      allocationBasis,
      shouldSetValue: variant.current_market_value && allocationMethod === 'by_market_value' && !useCustomValue
    });
    if (variant.current_market_value && allocationMethod === 'by_market_value' && !useCustomValue) {
      console.log('Setting allocation basis to:', variant.current_market_value.toString());
      setAllocationBasis(variant.current_market_value.toString());
    }
  }, [variant, allocationMethod, useCustomValue]);

  const formatPrice = (price: number | null | undefined): string => {
    if (!price) return '$0.00';
    return `$${price.toFixed(2)}`;
  };

  const getValueSource = (): string => {
    if (allocationMethod === 'manual') return 'other';
    if (useCustomValue) return 'other';
    return variant.current_market_value ? 'pricecharting' : 'other';
  };

  const calculatePreviewPercentage = (): number | null => {
    if (allocationMethod !== 'by_market_value' || !allocationBasis || !quantity) return null;
    
    const currentItemValue = parseFloat(allocationBasis) * quantity;
    const existingMarketValueTotal = currentLineItems
      .filter(item => item.cost_assignment_method === 'by_market_value')
      .reduce((sum, item) => sum + (item.allocation_basis * item.quantity_expected), 0);
    
    const totalMarketValue = existingMarketValueTotal + currentItemValue;
    
    if (totalMarketValue === 0) return null;
    
    return Math.round((currentItemValue / totalMarketValue) * 100);
  };

  const handleAddToOrder = () => {
    console.log('handleAddToOrder clicked!', {
      allocationBasis,
      quantity,
      allocBasis: parseFloat(allocationBasis),
      isFormValid,
      allocationMethod,
      valueSource: getValueSource()
    });
    
    const allocBasis = parseFloat(allocationBasis);
    if (allocBasis <= 0 || quantity < 1) {
      console.log('handleAddToOrder - validation failed, returning early');
      return;
    }

    console.log('handleAddToOrder - calling onComplete with:', {
      allocation_basis: allocBasis,
      cost_assignment_method: allocationMethod,
      allocation_basis_source: getValueSource(),
      quantity: quantity
    });

    onComplete({
      allocation_basis: allocBasis,
      cost_assignment_method: allocationMethod,
      allocation_basis_source: getValueSource(),
      quantity: quantity
    });
  };

  const isFormValid = useMemo(() => {
    const isValid = allocationBasis !== '' && !isNaN(parseFloat(allocationBasis)) && parseFloat(allocationBasis) > 0 && quantity >= 1;
    console.log('Form validation (memoized):', {
      allocationBasis,
      allocationBasisEmpty: allocationBasis === '',
      isNaN: isNaN(parseFloat(allocationBasis)),
      parseFloat: parseFloat(allocationBasis),
      quantity,
      isValid
    });
    return isValid;
  }, [allocationBasis, quantity]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Selected Variant Summary */}
      <div style={{
        background: '#f8f9fa',
        padding: '12px',
        borderRadius: '4px',
        border: '1px solid #dee2e6'
      }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
          Selected Variant:
        </div>
        <div style={{ fontSize: '14px', fontWeight: '500' }}>
          {variant.display_name || `${variant.variant_type_code} Variant`} - {formatPrice(variant.current_market_value || variant.default_list_price)}
        </div>
      </div>

      {/* Cost Allocation Method */}
      <div>
        <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>
          Cost Allocation Method
        </h5>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            gap: '8px',
            padding: '8px',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: allocationMethod === 'manual' ? '#e7f3ff' : '#fff'
          }}>
            <input
              type="radio"
              name="allocationMethod"
              value="manual"
              checked={allocationMethod === 'manual'}
              onChange={(e) => setAllocationMethod(e.target.value as 'manual')}
              style={{ marginTop: '2px' }}
            />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '12px' }}>I know the exact unit cost</div>
              <div style={{ fontSize: '11px', color: '#6c757d' }}>Enter what you paid per item</div>
            </div>
          </label>

          <label style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            gap: '8px',
            padding: '8px',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: allocationMethod === 'by_market_value' ? '#e7f3ff' : '#fff'
          }}>
            <input
              type="radio"
              name="allocationMethod"
              value="by_market_value"
              checked={allocationMethod === 'by_market_value'}
              onChange={(e) => setAllocationMethod(e.target.value as 'by_market_value')}
              style={{ marginTop: '2px' }}
            />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '12px' }}>Use market value (proportional)</div>
              <div style={{ fontSize: '11px', color: '#6c757d' }}>Allocate costs based on relative market values</div>
            </div>
          </label>
        </div>
      </div>

      {/* Allocation Input */}
      <div>
        <label style={{ 
          display: 'block', 
          fontSize: '12px', 
          fontWeight: 'bold', 
          marginBottom: '4px',
          color: '#495057'
        }}>
          {allocationMethod === 'manual' ? 'Unit Cost Paid ($)' : 'Market Value ($)'}
        </label>
        <input
          type="number"
          value={allocationBasis}
          onChange={(e) => setAllocationBasis(e.target.value)}
          step="0.01"
          min="0"
          placeholder="0.00"
          required
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
        
        {allocationMethod === 'by_market_value' && variant.current_market_value && (
          <div style={{ marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
              <input
                type="checkbox"
                checked={useCustomValue}
                onChange={(e) => {
                  setUseCustomValue(e.target.checked);
                  if (!e.target.checked) {
                    setAllocationBasis(variant.current_market_value?.toString() || '');
                  }
                }}
              />
              Override with custom value
            </label>
          </div>
        )}
      </div>

      {/* Allocation Preview */}
      {allocationMethod === 'by_market_value' && calculatePreviewPercentage() !== null && (
        <div style={{
          background: '#e7f3ff',
          padding: '8px 12px',
          borderRadius: '4px',
          border: '1px solid #b8daff'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#004085' }}>Preview:</div>
          <div style={{ fontSize: '12px', color: '#004085' }}>
            This item will be ~{calculatePreviewPercentage()}% of allocated costs
          </div>
        </div>
      )}

      {/* Quantity */}
      <div>
        <label style={{ 
          display: 'block', 
          fontSize: '12px', 
          fontWeight: 'bold', 
          marginBottom: '4px',
          color: '#495057'
        }}>
          Quantity *
        </label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          min="1"
          max="999"
          required
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          onClick={onBack}
          style={{
            flex: 1,
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid #6c757d',
            borderRadius: '4px',
            color: '#6c757d',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ← Back to Variants
        </button>
        <button
          onClick={handleAddToOrder}
          onMouseDown={() => console.log('Button mouse down')}
          onMouseUp={() => console.log('Button mouse up')}
          disabled={!isFormValid}
          style={{
            flex: 2,
            padding: '8px 16px',
            background: isFormValid ? '#28a745' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: isFormValid ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
            position: 'relative',
            zIndex: 1000
          }}
        >
          Add to Order
        </button>
      </div>
    </div>
  );
};

export default CostAllocationPanel;
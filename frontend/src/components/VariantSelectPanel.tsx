import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ProductVariant, VariantType } from '../types/api';

interface AllocationDetails {
  allocation_basis: number;
  cost_assignment_method: 'manual' | 'by_market_value';
  allocation_basis_source: string;
  quantity: number;
}

interface VariantSelectPanelProps {
  variantTypes: VariantType[];
  availableVariants: ProductVariant[];
  onVariantSelected: (variant: ProductVariant, allocation: AllocationDetails) => void;
  onCreateVariant: (variantTypeId: number, defaultListPrice?: number) => void;
  currentLineItems: Array<{allocation_basis: number; quantity_expected: number; cost_assignment_method: string}>;
  loading: boolean;
  showCreateVariant: boolean;
}

const VariantSelectPanel: React.FC<VariantSelectPanelProps> = ({
  variantTypes,
  availableVariants,
  onVariantSelected,
  onCreateVariant,
  currentLineItems,
  loading,
  showCreateVariant
}) => {
  // For creating new variants
  const [createMode, setCreateMode] = useState(showCreateVariant);
  const [newVariantTypeId, setNewVariantTypeId] = useState(0);
  const [newVariantPrice, setNewVariantPrice] = useState('');
  
  // For cost allocation
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [allocationMethod, setAllocationMethod] = useState<'manual' | 'by_market_value'>('by_market_value');
  const [allocationBasis, setAllocationBasis] = useState<string>('');
  const [useCustomValue, setUseCustomValue] = useState(false);
  const [quantity, setQuantity] = useState(1);
  
  // Keyboard navigation state
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const variantListRef = useRef<HTMLDivElement>(null);
  const allocationInputRef = useRef<HTMLInputElement>(null);
  const addToOrderButtonRef = useRef<HTMLButtonElement>(null);

  // Initialize allocation basis when variant changes
  useEffect(() => {
    if (selectedVariant?.current_market_value && allocationMethod === 'by_market_value' && !useCustomValue) {
      setAllocationBasis(selectedVariant.current_market_value.toString());
      
      // Auto-focus Add to Order button when form becomes valid with prefilled values
      setTimeout(() => {
        if (addToOrderButtonRef.current) {
          addToOrderButtonRef.current.focus();
        }
      }, 200); // Small delay to ensure form validation has updated
    }
  }, [selectedVariant, allocationMethod, useCustomValue]);

  // Reset selected variant index when variants change
  useEffect(() => {
    console.log('VariantSelectPanel - availableVariants changed:', availableVariants.length, 'variants');
    setSelectedVariantIndex(0);
    // Ensure no variant is auto-selected - only highlighted
    setSelectedVariant(null);
  }, [availableVariants]);

  // Keyboard navigation for variant selection (only when no variant is selected)
  useEffect(() => {
    if (selectedVariant) return; // Only handle keyboard navigation when selecting variants

    const handleKeyDown = (e: KeyboardEvent) => {
      if (availableVariants.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedVariantIndex(prev => (prev + 1) % availableVariants.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedVariantIndex(prev => prev === 0 ? availableVariants.length - 1 : prev - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (availableVariants[selectedVariantIndex]) {
            handleVariantSelect(availableVariants[selectedVariantIndex]);
          }
          break;
      }
    };

    // Add a small delay to prevent capturing Enter key from ProductSearch
    const timeoutId = setTimeout(() => {
      document.addEventListener('keydown', handleKeyDown);
    }, 200); // 200ms delay to ensure ProductSearch Enter event is fully processed

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedVariant, availableVariants, selectedVariantIndex]);

  const handleVariantSelect = (variant: ProductVariant) => {
    console.log('Variant selected:', variant);
    setSelectedVariant(variant);
    // Reset allocation form
    setAllocationBasis('');
    setAllocationMethod('by_market_value');
    setUseCustomValue(false);
    setQuantity(1);
    
    // Auto-focus the allocation input after variant selection
    setTimeout(() => {
      allocationInputRef.current?.focus();
    }, 100);
  };


  const handleCreateVariant = () => {
    if (newVariantTypeId > 0) {
      const price = newVariantPrice ? parseFloat(newVariantPrice) : undefined;
      onCreateVariant(newVariantTypeId, price);
    }
  };

  const formatPrice = (price?: number) => {
    return price ? `$${price.toFixed(2)}` : 'No price';
  };

  const getValueSource = useCallback((): string => {
    if (allocationMethod === 'manual') return 'other';
    if (useCustomValue) return 'other';
    return selectedVariant?.current_market_value ? 'pricecharting' : 'other';
  }, [allocationMethod, useCustomValue, selectedVariant]);

  const isFormValid = useMemo(() => {
    return selectedVariant && allocationBasis !== '' && !isNaN(parseFloat(allocationBasis)) && parseFloat(allocationBasis) > 0 && quantity >= 1;
  }, [selectedVariant, allocationBasis, quantity]);

  const handleAddToOrder = useCallback(() => {
    if (!selectedVariant || !isFormValid) return;

    const allocation: AllocationDetails = {
      allocation_basis: parseFloat(allocationBasis),
      cost_assignment_method: allocationMethod,
      allocation_basis_source: getValueSource(),
      quantity: quantity
    };

    onVariantSelected(selectedVariant, allocation);
  }, [selectedVariant, isFormValid, allocationBasis, allocationMethod, quantity, onVariantSelected, getValueSource]);

  // Keyboard support for submitting the allocation form
  useEffect(() => {
    if (!selectedVariant) return; // Only when in allocation mode

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && isFormValid) {
        e.preventDefault();
        handleAddToOrder();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedVariant, isFormValid, handleAddToOrder]);

  return (
    <div className="variant-select-panel">
      <div className="panel-header">
        <h4>{selectedVariant ? 'Configure Cost Allocation' : 'Select Variant'}</h4>
        <div className="panel-subtitle">
          {selectedVariant ? 'Set pricing and quantity for this item' : 'Choose the variant you want to add to your purchase order'}
        </div>
        {selectedVariant && (
          <button 
            onClick={() => setSelectedVariant(null)}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              border: '1px solid #6c757d',
              borderRadius: '3px',
              color: '#6c757d',
              fontSize: '10px',
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            ← Back to Variants
          </button>
        )}
      </div>

      {!selectedVariant && (
        <>
          {/* Existing Variants */}
          {availableVariants.length > 0 && (
            <div className="existing-variants">
              <h5>Available Variants</h5>
              <div className="variants-list" ref={variantListRef}>
                {availableVariants.map((variant, index) => (
                  <div 
                    key={variant.variant_id}
                    className={`variant-item ${index === selectedVariantIndex ? 'selected' : ''}`}
                    onClick={() => handleVariantSelect(variant)}
                  >
                    <div className="variant-info">
                      <div className="variant-name">{variant.display_name || `${variant.variant_type_code || 'Unknown'} Variant`}</div>
                      <div className="variant-code">({variant.variant_type_code || 'UNKNOWN'})</div>
                    </div>
                    <div className="variant-price">
                      {formatPrice(variant.current_market_value || variant.default_list_price)}
                    </div>
                    <div className="variant-select-indicator">
                      {index === selectedVariantIndex ? '→' : '○'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create New Variant */}
          {(showCreateVariant || availableVariants.length === 0) && (
            <div className="create-variant-section">
              {availableVariants.length > 0 && !createMode ? (
                <button 
                  onClick={() => setCreateMode(true)}
                  className="show-create-button"
                >
                  + Create Additional Variant
                </button>
              ) : (
                <div className="create-variant-form">
                  <h5>Create New Variant</h5>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="variant_type_id">Variant Type *</label>
                      <select
                        id="variant_type_id"
                        value={newVariantTypeId}
                        onChange={(e) => setNewVariantTypeId(parseInt(e.target.value))}
                        required
                      >
                        <option value="">Select Type</option>
                        {variantTypes.map(type => (
                          <option key={type.variant_type_id} value={type.variant_type_id}>
                            {type.display_name} ({type.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="default_price">Default Price</label>
                      <input
                        type="number"
                        id="default_price"
                        value={newVariantPrice}
                        onChange={(e) => setNewVariantPrice(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleCreateVariant}
                    disabled={!newVariantTypeId || loading}
                    className="create-variant-button"
                  >
                    {loading && <span className="loading-spinner"></span>}
                    {loading ? 'Creating Variant...' : 'Create Variant'}
                  </button>
                  
                  {availableVariants.length > 0 && (
                    <button 
                      onClick={() => setCreateMode(false)}
                      className="cancel-create-button"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Cost Allocation Form */}
      {selectedVariant && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
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
              {selectedVariant.display_name || `${selectedVariant.variant_type_code} Variant`} - {formatPrice(selectedVariant.current_market_value || selectedVariant.default_list_price)}
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
              ref={allocationInputRef}
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
            
            {allocationMethod === 'by_market_value' && selectedVariant.current_market_value && (
              <div style={{ marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                  <input
                    type="checkbox"
                    checked={useCustomValue}
                    onChange={(e) => {
                      setUseCustomValue(e.target.checked);
                      if (!e.target.checked) {
                        setAllocationBasis(selectedVariant.current_market_value?.toString() || '');
                      }
                    }}
                  />
                  Override with custom value
                </label>
              </div>
            )}
          </div>

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

          {/* Add to Order Button */}
          <button
            ref={addToOrderButtonRef}
            onClick={handleAddToOrder}
            disabled={!isFormValid}
            style={{
              padding: '12px 24px',
              background: isFormValid ? '#28a745' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: isFormValid ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            Add to Order
          </button>
        </div>
      )}


      {loading && (
        <div className="panel-loading">
          <div className="loading-spinner"></div>
          Processing...
        </div>
      )}
    </div>
  );
};

export default VariantSelectPanel;
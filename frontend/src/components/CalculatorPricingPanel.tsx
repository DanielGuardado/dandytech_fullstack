import React, { useState, useEffect, useRef } from 'react';
import { ProductVariant, Platform } from '../types/api';
import { CalculatorConfig, CalculatorItemCreate } from '../types/calculator';
import { calculatorService } from '../services/calculatorService';

interface CalculatorPricingPanelProps {
  selectedVariant: ProductVariant;
  productTitle: string;
  platforms: Platform[];
  config: Record<string, CalculatorConfig>;
  onAddItem: (item: CalculatorItemCreate) => void;
  loading: boolean;
}

const CalculatorPricingPanel: React.FC<CalculatorPricingPanelProps> = ({
  selectedVariant,
  productTitle,
  platforms,
  config,
  onAddItem,
  loading
}) => {
  // Form state
  const [marketPrice, setMarketPrice] = useState<string>('');
  const [overridePrice, setOverridePrice] = useState<string>('');
  const [useOverride, setUseOverride] = useState(false);
  const [markupAmount, setMarkupAmount] = useState<string>('');
  const [targetProfitPercentage, setTargetProfitPercentage] = useState<string>('25');
  const [quantity, setQuantity] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');
  const [hasManual, setHasManual] = useState<boolean>(true);
  const [customDeductions, setCustomDeductions] = useState<string>('');

  // Calculated values
  const [calculations, setCalculations] = useState<{
    estimatedSalePrice: number;
    salesTax: number;
    finalValue: number;
    baseVariableFee: number;
    discountedVariableFee: number;
    transactionFee: number;
    adFee: number;
    shippingCost: number;
    suppliesCost: number;
    regularCashback: number;
    shippingCashback: number;
    totalCashback: number;
    totalFees: number;
    netAfterFees: number;
    calculatedPurchasePrice: number;
    profitPerItem: number;
    profitMargin: number;
  } | null>(null);

  // Refs for focus management
  const marketPriceRef = useRef<HTMLInputElement>(null);
  const overridePriceRef = useRef<HTMLInputElement>(null);
  const markupRef = useRef<HTMLInputElement>(null);

  // Helper function for consistent focus styling
  const addFocusHandlers = () => ({
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      e.target.style.borderColor = '#007aff';
      e.target.style.boxShadow = '0 0 0 3px rgba(0, 122, 255, 0.15)';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      e.target.style.borderColor = '#dee2e6';
      e.target.style.boxShadow = 'none';
    }
  });

  // Initialize form with variant data and platform defaults
  useEffect(() => {
    // Set market price from variant
    if (selectedVariant.current_market_value) {
      setMarketPrice(selectedVariant.current_market_value.toString());
    }

    // Find platform and set default markup
    if (selectedVariant.variant_id) {
      // We'll need to determine platform from the product context
      // For now, use the default markup from config
      const defaultMarkup = config.ebay_markup_amount?.config_value || 3.50;
      setMarkupAmount(defaultMarkup.toString());
    }

    // Auto-focus market price field
    setTimeout(() => {
      if (marketPriceRef.current) {
        marketPriceRef.current.focus();
      }
    }, 100);
  }, [selectedVariant, config]);

  // Recalculate when inputs change
  useEffect(() => {
    const basePrice = parseFloat(useOverride ? overridePrice : marketPrice);
    const markup = parseFloat(markupAmount);
    const profit = parseFloat(targetProfitPercentage);
    const qty = parseInt(quantity);

    if (isNaN(basePrice) || isNaN(markup) || isNaN(profit) || isNaN(qty) || 
        basePrice <= 0 || markup < 0 || profit < 0 || qty <= 0) {
      setCalculations(null);
      return;
    }

    // Calculate deductions for CIB items without manual
    let deductions = 0;
    const customDeductionAmount = parseFloat(customDeductions) || 0;
    
    // Auto deduction for CIB without manual (assuming we'll add logic to detect manual-sensitive platforms)
    const isCIB = selectedVariant.variant_type_code === 'CIB';
    if (isCIB && !hasManual && customDeductionAmount === 0) {
      deductions = markup; // Default to markup amount
    } else if (customDeductionAmount > 0) {
      deductions = customDeductionAmount;
    }
    
    // Perform calculation using the same logic as the backend
    const estimatedSalePrice = basePrice + markup - deductions;
    
    // Step 1: Calculate sales tax and final value (what buyer pays)
    const salesTaxRate = (config.sales_tax_avg?.config_value || 5.09) / 100;
    const salesTax = estimatedSalePrice * salesTaxRate;
    const finalValue = estimatedSalePrice + salesTax;
    
    // Step 2: Determine if this is a game or console (assume game for now)
    const isConsole = false; // TODO: Could check variant type or category
    const variableFeeRate = isConsole 
      ? (config.variable_fee_consoles?.config_value || 7.35) / 100
      : (config.variable_fee_games?.config_value || 12.7) / 100;
    const shippingCost = isConsole 
      ? (config.average_shipping_cost_consoles?.config_value || 12.00)
      : (config.average_shipping_cost?.config_value || 4.40);
    
    // Supplies cost based on sale price threshold
    const suppliesCost = estimatedSalePrice <= 40 
      ? (config.shipping_supplies_cost_under_40?.config_value || 0.15)
      : (config.shipping_supplies_cost_over_40?.config_value || 1.00);
    
    // Step 3: Calculate variable fee with top seller discount
    const baseVariableFee = finalValue * variableFeeRate;
    const topSellerDiscountRate = (config.top_seller_discount?.config_value || 10.0) / 100;
    const discountedVariableFee = baseVariableFee * (1 - topSellerDiscountRate);
    
    // Step 4: Transaction fee = discounted variable fee + flat fee
    const flatFee = config.flat_trx_fee?.config_value || 0.40;
    const transactionFee = discountedVariableFee + flatFee;
    
    // Step 5: Ad fee based on final value
    const adFeeRate = (config.ad_fee?.config_value || 3.30) / 100;
    const adFee = finalValue * adFeeRate;
    
    // Step 6: Total fees
    const totalFees = transactionFee + adFee + shippingCost + suppliesCost;
    
    // Step 7: Calculate cashback (money back to us)
    const regularCashbackRate = (config.regular_cashback_rate?.config_value || 1.0) / 100;
    const shippingCashbackRate = (config.shipping_cashback_rate?.config_value || 3.0) / 100;
    const regularCashback = estimatedSalePrice * regularCashbackRate;
    const shippingCashback = shippingCost * shippingCashbackRate;
    const totalCashback = regularCashback + shippingCashback;
    
    // Step 8: Net after fees (we collect tax but remit it, so it nets out)
    const netAfterFees = estimatedSalePrice - totalFees + totalCashback;
    
    // Step 9: Calculate purchase price based on target profit margin
    const calculatedPurchasePrice = Math.max(0, netAfterFees * (1 - profit / 100));
    const profitPerItem = netAfterFees - calculatedPurchasePrice;
    const profitMargin = netAfterFees > 0 ? (profitPerItem / netAfterFees) * 100 : 0;

    setCalculations({
      estimatedSalePrice,
      salesTax,
      finalValue,
      baseVariableFee,
      discountedVariableFee,
      transactionFee,
      adFee,
      shippingCost,
      suppliesCost,
      regularCashback,
      shippingCashback,
      totalCashback,
      totalFees,
      netAfterFees,
      calculatedPurchasePrice,
      profitPerItem,
      profitMargin
    });
  }, [marketPrice, overridePrice, useOverride, markupAmount, targetProfitPercentage, quantity, hasManual, customDeductions, selectedVariant.variant_type_code, config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!calculations) return;

    // Calculate deductions for submission
    const isCIB = selectedVariant.variant_type_code === 'CIB';
    const markupValue = parseFloat(markupAmount) || 0;
    const customDeductionAmount = parseFloat(customDeductions) || 0;
    let finalDeductions = 0;
    let deductionReasons: Record<string, number> = {};
    
    if (isCIB && !hasManual && customDeductionAmount === 0) {
      finalDeductions = markupValue;
      deductionReasons = { "no_manual": markupValue };
    } else if (customDeductionAmount > 0) {
      finalDeductions = customDeductionAmount;
      deductionReasons = { "custom": customDeductionAmount };
    }

    const itemData: CalculatorItemCreate = {
      catalog_product_id: undefined, // Will be set by parent
      variant_id: selectedVariant.variant_id,
      product_title: productTitle,
      variant_type_code: selectedVariant.variant_type_code,
      market_price: marketPrice && parseFloat(marketPrice) > 0 ? parseFloat(marketPrice) : undefined,
      override_price: useOverride && overridePrice && parseFloat(overridePrice) > 0 ? parseFloat(overridePrice) : undefined,
      markup_amount: markupValue >= 0 ? markupValue : undefined,
      deductions: finalDeductions > 0 ? finalDeductions : undefined,
      deduction_reasons: Object.keys(deductionReasons).length > 0 ? deductionReasons : undefined,
      has_manual: isCIB ? hasManual : undefined, // Only set for CIB items
      target_profit_percentage: parseFloat(targetProfitPercentage),
      quantity: parseInt(quantity),
      notes: notes.trim() || undefined
    };

    onAddItem(itemData);
  };

  const isFormValid = calculations && 
    parseFloat(useOverride ? overridePrice : marketPrice) > 0 &&
    parseFloat(markupAmount) >= 0 &&
    parseFloat(targetProfitPercentage) >= 0 &&
    parseInt(quantity) > 0;

  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #dee2e6',
        background: '#f8f9fa',
        flexShrink: 0
      }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#495057' }}>
          Calculator Pricing
        </h4>
        <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
          {productTitle} - {selectedVariant.display_name}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        padding: '12px',
        gap: '8px',
        overflow: 'auto'
      }}>
        
        {/* Row 1: Market Price | Override Price */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Market Price */}
          <div style={{ flex: 1 }}>
            <label style={{ 
              display: 'block', 
              fontSize: '12px', 
              fontWeight: 'bold', 
              color: '#6c757d', 
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Market Price *
            </label>
            <input
              ref={marketPriceRef}
              type="number"
              step="0.01"
              min="0"
              value={marketPrice}
              onChange={(e) => setMarketPrice(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '14px',
                textAlign: 'right',
                fontFamily: 'monospace'
              }}
              {...addFocusHandlers()}
              required
            />
          </div>

          {/* Override Price */}
          <div style={{ flex: 1 }}>
            <label style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px', 
              fontWeight: 'bold', 
              color: '#6c757d', 
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              <input
                type="checkbox"
                checked={useOverride}
                onChange={(e) => setUseOverride(e.target.checked)}
                disabled={loading}
              />
              Override Price
            </label>
            <input
              ref={overridePriceRef}
              type="number"
              step="0.01"
              min="0"
              value={overridePrice}
              onChange={(e) => setOverridePrice(e.target.value)}
              disabled={loading || !useOverride}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '14px',
                textAlign: 'right',
                fontFamily: 'monospace',
                opacity: useOverride ? 1 : 0.6
              }}
              {...addFocusHandlers()}
            />
          </div>
        </div>

        {/* Row 2: Markup | Target Profit | Quantity */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Markup Amount */}
          <div style={{ flex: 1 }}>
            <label style={{ 
              display: 'block', 
              fontSize: '12px', 
              fontWeight: 'bold', 
              color: '#6c757d', 
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Markup *
            </label>
            <input
              ref={markupRef}
              type="number"
              step="0.01"
              min="0"
              value={markupAmount}
              onChange={(e) => setMarkupAmount(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '14px',
                textAlign: 'right',
                fontFamily: 'monospace'
              }}
              {...addFocusHandlers()}
              required
            />
          </div>

          {/* Target Profit Percentage */}
          <div style={{ flex: 1 }}>
            <label style={{ 
              display: 'block', 
              fontSize: '12px', 
              fontWeight: 'bold', 
              color: '#6c757d', 
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Target % *
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={targetProfitPercentage}
              onChange={(e) => setTargetProfitPercentage(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '14px',
                textAlign: 'right',
                fontFamily: 'monospace'
              }}
              {...addFocusHandlers()}
              required
            />
          </div>

          {/* Quantity */}
          <div style={{ flex: 1 }}>
            <label style={{ 
              display: 'block', 
              fontSize: '12px', 
              fontWeight: 'bold', 
              color: '#6c757d', 
              marginBottom: '4px',
              textTransform: 'uppercase'
            }}>
              Qty *
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '14px',
                textAlign: 'right',
                fontFamily: 'monospace'
              }}
              {...addFocusHandlers()}
              required
            />
          </div>
        </div>

        {/* Row 3: Notes (full width) */}
        <div>
          <label style={{ 
            display: 'block', 
            fontSize: '12px', 
            fontWeight: 'bold', 
            color: '#6c757d', 
            marginBottom: '4px',
            textTransform: 'uppercase'
          }}>
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
            rows={2}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '14px',
              resize: 'vertical'
            }}
            {...addFocusHandlers()}
          />
        </div>

        {/* CIB Manual and Deductions Section */}
        {selectedVariant.variant_type_code === 'CIB' && (
          <div style={{
            background: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            padding: '12px',
            marginTop: '8px'
          }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold', color: '#856404' }}>
              📋 CIB Item Options
            </h5>
            
            {/* Manual Checkbox */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#495057',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={hasManual}
                  onChange={(e) => setHasManual(e.target.checked)}
                  disabled={loading}
                  style={{
                    width: '16px',
                    height: '16px'
                  }}
                />
                📖 Includes Manual
                {!hasManual && (
                  <span style={{ color: '#dc3545', fontSize: '10px', marginLeft: '4px' }}>
                    (Will deduct ${parseFloat(markupAmount) || 0} from sale price)
                  </span>
                )}
              </label>
            </div>

            {/* Custom Deductions */}
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '11px', 
                fontWeight: 'bold', 
                color: '#6c757d', 
                marginBottom: '4px',
                textTransform: 'uppercase'
              }}>
                Custom Deductions (overrides manual deduction)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={customDeductions}
                onChange={(e) => setCustomDeductions(e.target.value)}
                disabled={loading}
                placeholder="Additional price reduction"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '12px',
                  textAlign: 'right',
                  fontFamily: 'monospace'
                }}
                {...addFocusHandlers()}
              />
            </div>
          </div>
        )}

        {/* Calculations Display */}
        {calculations && (
          <div style={{
            background: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '4px',
            padding: '12px',
            marginTop: '8px'
          }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>
              📊 Calculation Breakdown
            </h5>
            <div style={{ display: 'grid', gap: '3px', fontSize: '11px' }}>
              
              {/* Basic Pricing */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d' }}>Sale Price:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#28a745' }}>
                  {calculatorService.formatCurrency(calculations.estimatedSalePrice)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d' }}>Sales Tax (5.09%):</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {calculatorService.formatCurrency(calculations.salesTax)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '3px', borderBottom: '1px solid #dee2e6' }}>
                <span style={{ color: '#6c757d', fontWeight: 'bold' }}>Final Value:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#007bff' }}>
                  {calculatorService.formatCurrency(calculations.finalValue)}
                </span>
              </div>
              
              {/* Fees Breakdown */}
              <div style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'bold', marginTop: '4px' }}>📉 FEES:</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d' }}>Variable Fee (12.7%):</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {calculatorService.formatCurrency(calculations.baseVariableFee)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d' }}>Top Seller (-10%):</span>
                <span style={{ fontFamily: 'monospace', color: '#28a745' }}>
                  -{calculatorService.formatCurrency(calculations.baseVariableFee - calculations.discountedVariableFee)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d' }}>Transaction Fee:</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {calculatorService.formatCurrency(calculations.transactionFee)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d' }}>Ad Fee (3.3%):</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {calculatorService.formatCurrency(calculations.adFee)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d' }}>Shipping:</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {calculatorService.formatCurrency(calculations.shippingCost)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '3px', borderBottom: '1px solid #dee2e6' }}>
                <span style={{ color: '#6c757d' }}>Supplies:</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {calculatorService.formatCurrency(calculations.suppliesCost)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d', fontWeight: 'bold' }}>Total Fees:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#dc3545' }}>
                  {calculatorService.formatCurrency(calculations.totalFees)}
                </span>
              </div>
              
              {/* Cashback */}
              <div style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'bold', marginTop: '4px' }}>💰 CASHBACK:</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d' }}>Regular (1%):</span>
                <span style={{ fontFamily: 'monospace', color: '#28a745' }}>
                  +{calculatorService.formatCurrency(calculations.regularCashback)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '3px', borderBottom: '1px solid #dee2e6' }}>
                <span style={{ color: '#6c757d' }}>Shipping (3%):</span>
                <span style={{ fontFamily: 'monospace', color: '#28a745' }}>
                  +{calculatorService.formatCurrency(calculations.shippingCashback)}
                </span>
              </div>
              
              {/* Final Results */}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid #495057' }}>
                <span style={{ color: '#495057', fontWeight: 'bold' }}>✅ Net Amount:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#495057', fontSize: '13px' }}>
                  {calculatorService.formatCurrency(calculations.netAfterFees)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d', fontWeight: 'bold' }}>💵 Max Purchase:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#007bff', fontSize: '14px' }}>
                  {calculatorService.formatCurrency(calculations.calculatedPurchasePrice)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d' }}>📈 Profit Margin:</span>
                <span style={{ 
                  fontFamily: 'monospace', 
                  fontWeight: 'bold',
                  color: calculatorService.getProfitMarginColor(calculations.profitMargin)
                }}>
                  {calculatorService.formatPercentage(calculations.profitMargin)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div style={{ 
          marginTop: 'auto',
          paddingTop: '16px',
          borderTop: '1px solid #dee2e6'
        }}>
          <button
            type="submit"
            disabled={loading || !isFormValid}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: isFormValid && !loading ? '#28a745' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: isFormValid && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading && (
              <span style={{ 
                display: 'inline-block', 
                width: '16px', 
                height: '16px', 
                border: '2px solid rgba(255,255,255,0.3)', 
                borderRadius: '50%', 
                borderTopColor: '#fff',
                animation: 'spin 0.8s linear infinite'
              }}></span>
            )}
            {loading ? 'Adding...' : '🧮 Add to Calculator'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CalculatorPricingPanel;
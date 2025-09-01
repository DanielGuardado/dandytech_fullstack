import React from 'react';
import { 
  Platform
} from '../types/api';
import {
  CalculatorItem,
  CalculatorItemUpdate
} from '../types/calculator';
import { calculatorService } from '../services/calculatorService';
import CalculatorTooltip from './CalculatorTooltip';

interface CalculatorItemTableProps {
  items: CalculatorItem[];
  platforms: Platform[];
  loading: boolean;
  editingItemId: number | null;
  editingItemData: any;
  onUpdateItem: (itemId: number, updates: CalculatorItemUpdate) => void;
  onDeleteItem: (itemId: number) => void;
  onStartEdit: (itemId: number, itemData: CalculatorItem) => void;
  onCancelEdit: () => void;
  canEdit: boolean;
}

const CalculatorItemTable: React.FC<CalculatorItemTableProps> = ({
  items,
  platforms,
  loading,
  editingItemId,
  editingItemData,
  onUpdateItem,
  onDeleteItem,
  onStartEdit,
  onCancelEdit,
  canEdit
}) => {

  // Helper function to generate fee breakdown tooltip content
  const getFeesTooltip = (item: CalculatorItem) => {
    if (!item.total_fees) return null;
    
    const discount = (item.base_variable_fee && item.discounted_variable_fee) 
      ? item.base_variable_fee - item.discounted_variable_fee 
      : 0;

    return `📉 FEE BREAKDOWN:
Variable Fee (Base): ${calculatorService.formatCurrency(item.base_variable_fee || 0)}
Top Seller Discount: -${calculatorService.formatCurrency(discount)}
Transaction Fee: ${calculatorService.formatCurrency(item.transaction_fee || 0)}
Ad Fee: ${calculatorService.formatCurrency(item.ad_fee || 0)}
Shipping: ${calculatorService.formatCurrency(item.shipping_cost || 0)}
Supplies: ${calculatorService.formatCurrency(item.supplies_cost || 0)}
Total Fees: ${calculatorService.formatCurrency(item.total_fees)}`;
  };

  // Helper function to generate net calculation tooltip content
  const getNetTooltip = (item: CalculatorItem) => {
    if (!item.net_after_fees) return null;
    
    const totalCashback = (item.regular_cashback || 0) + (item.shipping_cashback || 0);

    return `💰 NET CALCULATION:
Sale Price: ${calculatorService.formatCurrency(item.estimated_sale_price || 0)}
Total Fees: -${calculatorService.formatCurrency(item.total_fees || 0)}
💰 CASHBACK:
Regular (1%): +${calculatorService.formatCurrency(item.regular_cashback || 0)}
Shipping (3%): +${calculatorService.formatCurrency(item.shipping_cashback || 0)}
✅ Net Amount: ${calculatorService.formatCurrency(item.net_after_fees)}`;
  };

  // Helper function to generate deductions tooltip content
  const getDeductionsTooltip = (item: CalculatorItem) => {
    if (!item.deductions || item.deductions <= 0) return null;
    
    try {
      const reasons = item.deduction_reasons ? JSON.parse(item.deduction_reasons) : {};
      const reasonsText = Object.entries(reasons)
        .map(([reason, amount]: [string, any]) => `${reason.replace('_', ' ')}: -${calculatorService.formatCurrency(amount)}`)
        .join('\n');
      
      return `🔻 DEDUCTION BREAKDOWN:
${reasonsText || 'Custom deduction: -' + calculatorService.formatCurrency(item.deductions)}
Total Deductions: -${calculatorService.formatCurrency(item.deductions)}`;
    } catch (e) {
      return `🔻 DEDUCTIONS: -${calculatorService.formatCurrency(item.deductions)}`;
    }
  };

  // Helper function to generate sale price tooltip content
  const getSaleTooltip = (item: CalculatorItem) => {
    if (!item.estimated_sale_price) return null;

    const finalValue = item.final_value || 0;
    const salesTax = item.sales_tax || 0;
    const deductions = item.deductions || 0;

    return `📊 SALE BREAKDOWN:
Base Price: ${calculatorService.formatCurrency(item.final_base_price || 0)}
Markup: +${calculatorService.formatCurrency(item.markup_amount || 0)}${deductions > 0 ? '\nDeductions: -' + calculatorService.formatCurrency(deductions) : ''}
Sale Price: ${calculatorService.formatCurrency(item.estimated_sale_price)}
Sales Tax (5.09%): ${calculatorService.formatCurrency(salesTax)}
Final Value: ${calculatorService.formatCurrency(finalValue)}`;
  };

  if (items.length === 0) {
    return (
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#6c757d',
        fontSize: '14px',
        textAlign: 'center',
        padding: '40px'
      }}>
        <div>
          No items in calculator yet
          <br />
          <span style={{ fontSize: '12px' }}>Click "Add Item" to get started</span>
        </div>
      </div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6', position: 'sticky', top: 0, zIndex: 1 }}>
          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Product</th>
          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Variant</th>
          <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Qty</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px', cursor: 'help' }} title="Current market value from PriceCharting or manual entry">Market $</th>
          <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px', cursor: 'help' }} title="Percentage of market price for this purchase">% of Market 🎯</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px', cursor: 'help' }} title="Your maximum purchase price based on target profit">Purchase $</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Markup</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px', cursor: 'help' }} title="Price deductions (e.g. missing manual)">Deductions</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Sale $</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Fees</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px', cursor: 'help' }} title="Shipping cost for this item">Shipping</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Net $</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Earnings</th>
          <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px', cursor: 'help' }} title="Profit margin after all fees and costs">Margin % 📊</th>
          <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px', cursor: 'help' }} title="Return on investment (profit as % of cost)">ROI % 📈</th>
          {canEdit && (
            <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Actions</th>
          )}
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => (
          <tr 
            key={item.item_id} 
            style={{ 
              background: index % 2 === 0 ? '#fff' : '#f9f9f9',
              borderBottom: '1px solid #e9ecef'
            }}
          >
            {/* 1. Product */}
            <td style={{ padding: '8px 10px', fontSize: '13px' }}>
              <div style={{ fontWeight: 'bold' }}>
                {item.product_title || 'Unknown Product'}
                {item.platform_short_name && ` - ${item.platform_short_name}`}
              </div>
            </td>
            {/* 2. Variant */}
            <td style={{ padding: '8px 10px', fontSize: '13px' }}>
              {item.variant_type_code || 'Unknown'}
            </td>
            {/* 3. Qty */}
            <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {item.quantity}
            </td>
            {/* 4. Market $ - blue color */}
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#007bff' }}>
                  {calculatorService.formatCurrency(item.market_price || item.final_base_price || 0)}
                </div>
                <div style={{
                  fontSize: '9px',
                  background: item.cost_source === 'pricecharting' ? '#17a2b8' :
                              item.cost_source === 'manual' ? '#6c757d' :
                              item.cost_source === 'pricecharting_override' ? '#ffc107' : '#343a40',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '2px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  marginTop: '2px'
                }}>
                  {item.cost_source === 'pricecharting' ? 'PC' :
                   item.cost_source === 'manual' ? 'Manual' :
                   item.cost_source === 'pricecharting_override' ? 'PC+' : 'Other'}
                </div>
              </div>
            </td>
            {/* 5. % of Market - with color coding */}
            <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {item.market_price && item.calculated_purchase_price ? (
                <span style={{ 
                  color: calculatorService.getPercentOfMarketColor(
                    (item.calculated_purchase_price / item.market_price) * 100
                  )
                }}>
                  {`${((item.calculated_purchase_price / item.market_price) * 100).toFixed(1)}%`}
                </span>
              ) : '-'}
            </td>
            {/* 6. Purchase $ - red color */}
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#dc3545' }}>
              {item.calculated_purchase_price ? calculatorService.formatCurrency(item.calculated_purchase_price) : '-'}
            </td>
            {/* 7. Markup */}
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace' }}>
              {item.markup_amount ? calculatorService.formatCurrency(item.markup_amount) : '-'}
            </td>
            {/* 8. Deductions - orange color */}
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', color: '#fd7e14' }}>
              {item.deductions && item.deductions > 0 ? (
                <CalculatorTooltip content={getDeductionsTooltip(item)}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', cursor: 'help' }}>
                    <span style={{ fontWeight: 'bold' }}>
                      -{calculatorService.formatCurrency(item.deductions)}
                    </span>
                    {item.variant_type_code === 'CIB' && item.has_manual === false && (
                      <span style={{ fontSize: '9px', color: '#6c757d' }}>No Manual</span>
                    )}
                  </div>
                </CalculatorTooltip>
              ) : '-'}
            </td>
            {/* 9. Sale $ - green color */}
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#28a745' }}>
              {item.estimated_sale_price ? (
                <CalculatorTooltip content={getSaleTooltip(item)}>
                  <span style={{ cursor: 'help' }}>
                    {calculatorService.formatCurrency(item.estimated_sale_price)}
                  </span>
                </CalculatorTooltip>
              ) : '-'}
            </td>
            {/* 9. Fees - gray color */}
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', color: '#6c757d' }}>
              {item.total_fees ? (
                <CalculatorTooltip content={getFeesTooltip(item)}>
                  <span style={{ cursor: 'help' }}>
                    {calculatorService.formatCurrency(item.total_fees)}
                  </span>
                </CalculatorTooltip>
              ) : '-'}
            </td>
            {/* 10. Shipping Cost - green color */}
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#28a745' }}>
              {calculatorService.formatCurrency(item.shipping_cost || 0)}
            </td>
            {/* 11. Net $ - teal color */}
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#17a2b8' }}>
              {item.net_after_fees ? (
                <CalculatorTooltip content={getNetTooltip(item)}>
                  <span style={{ cursor: 'help' }}>
                    {calculatorService.formatCurrency(item.net_after_fees)}
                  </span>
                </CalculatorTooltip>
              ) : '-'}
            </td>
            {/* 11. Earnings - conditional color */}
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {item.net_after_fees && item.calculated_purchase_price ? (
                <span style={{ 
                  color: (item.net_after_fees - item.calculated_purchase_price) >= 0 ? '#28a745' : '#dc3545'
                }}>
                  {calculatorService.formatCurrency(item.net_after_fees - item.calculated_purchase_price)}
                </span>
              ) : '-'}
            </td>
            {/* 12. Margin % - with new color coding */}
            <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {item.net_after_fees && item.calculated_purchase_price ? (
                <span style={{ 
                  color: calculatorService.getProfitMarginColor(
                    calculatorService.calculateProfitMarginFromNet(
                      item.net_after_fees, 
                      item.calculated_purchase_price
                    )
                  )
                }}>
                  {calculatorService.formatPercentage(
                    calculatorService.calculateProfitMarginFromNet(
                      item.net_after_fees, 
                      item.calculated_purchase_price
                    )
                  )}
                </span>
              ) : '-'}
            </td>
            {/* 13. ROI % - with new color coding */}
            <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {item.net_after_fees && item.calculated_purchase_price ? (
                <span style={{ 
                  color: calculatorService.getROIColor(
                    calculatorService.calculateROIFromNet(
                      item.net_after_fees, 
                      item.calculated_purchase_price
                    )
                  )
                }}>
                  {calculatorService.formatPercentage(
                    calculatorService.calculateROIFromNet(
                      item.net_after_fees, 
                      item.calculated_purchase_price
                    )
                  )}
                </span>
              ) : '-'}
            </td>
            {/* 14. Actions */}
            {canEdit && (
              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                  <button
                    onClick={() => onStartEdit(item.item_id, item)}
                    disabled={loading || editingItemId !== null}
                    style={{
                      background: '#007bff',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '2px',
                      fontSize: '8px',
                      fontWeight: 'bold',
                      border: 'none',
                      cursor: loading || editingItemId !== null ? 'not-allowed' : 'pointer',
                      opacity: loading || editingItemId !== null ? 0.5 : 1
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteItem(item.item_id)}
                    disabled={loading || editingItemId !== null}
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '2px',
                      fontSize: '8px',
                      fontWeight: 'bold',
                      border: 'none',
                      cursor: loading || editingItemId !== null ? 'not-allowed' : 'pointer',
                      opacity: loading || editingItemId !== null ? 0.5 : 1
                    }}
                  >
                    Del
                  </button>
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default CalculatorItemTable;
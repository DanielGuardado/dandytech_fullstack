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

  // Helper function to generate sale price tooltip content
  const getSaleTooltip = (item: CalculatorItem) => {
    if (!item.estimated_sale_price) return null;

    const finalValue = item.final_value || 0;
    const salesTax = item.sales_tax || 0;

    return `📊 SALE BREAKDOWN:
Base Price: ${calculatorService.formatCurrency(item.final_base_price || 0)}
Markup: +${calculatorService.formatCurrency(item.markup_amount || 0)}
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
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Base Cost</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Markup</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Sale $</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Fees</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Net $</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Purchase $</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Earnings</th>
          <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>% of Market</th>
          <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Margin %</th>
          <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>ROI %</th>
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
            <td style={{ padding: '8px 10px', fontSize: '13px' }}>
              <div style={{ fontWeight: 'bold' }}>
                {item.product_title || 'Unknown Product'}
                {item.platform_short_name && ` - ${item.platform_short_name}`}
              </div>
            </td>
            <td style={{ padding: '8px 10px', fontSize: '13px' }}>
              {item.variant_type_code || 'Unknown'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {item.quantity}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {calculatorService.formatCurrency(item.final_base_price || 0)}
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
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace' }}>
              {item.markup_amount ? calculatorService.formatCurrency(item.markup_amount) : '-'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#28a745' }}>
              {item.estimated_sale_price ? (
                <CalculatorTooltip content={getSaleTooltip(item)}>
                  <span style={{ cursor: 'help' }}>
                    {calculatorService.formatCurrency(item.estimated_sale_price)}
                  </span>
                </CalculatorTooltip>
              ) : '-'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', color: '#dc3545' }}>
              {item.total_fees ? (
                <CalculatorTooltip content={getFeesTooltip(item)}>
                  <span style={{ cursor: 'help' }}>
                    {calculatorService.formatCurrency(item.total_fees)}
                  </span>
                </CalculatorTooltip>
              ) : '-'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {item.net_after_fees ? (
                <CalculatorTooltip content={getNetTooltip(item)}>
                  <span style={{ cursor: 'help' }}>
                    {calculatorService.formatCurrency(item.net_after_fees)}
                  </span>
                </CalculatorTooltip>
              ) : '-'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#007bff' }}>
              {item.calculated_purchase_price ? calculatorService.formatCurrency(item.calculated_purchase_price) : '-'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#28a745' }}>
              {item.net_after_fees && item.calculated_purchase_price ? 
                calculatorService.formatCurrency(item.net_after_fees - item.calculated_purchase_price) : '-'}
            </td>
            <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {item.market_price && item.calculated_purchase_price ? 
                `${((item.calculated_purchase_price / item.market_price) * 100).toFixed(1)}%` : '-'}
            </td>
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
            <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {item.net_after_fees && item.calculated_purchase_price ? (
                calculatorService.formatPercentage(
                  calculatorService.calculateROIFromNet(
                    item.net_after_fees, 
                    item.calculated_purchase_price
                  )
                )
              ) : '-'}
            </td>
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
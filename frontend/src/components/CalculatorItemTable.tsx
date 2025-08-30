import React from 'react';
import { 
  Platform
} from '../types/api';
import {
  CalculatorItem,
  CalculatorItemUpdate
} from '../types/calculator';
import { calculatorService } from '../services/calculatorService';

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
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Market $</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Override $</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Markup</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Sale $</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Fees</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Net $</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Purchase $</th>
          <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '11px' }}>Profit %</th>
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
              <div>
                <div style={{ fontWeight: 'bold' }}>
                  {item.product_title || 'Unknown Product'}
                </div>
                {item.platform_short_name && (
                  <div style={{ fontSize: '11px', color: '#6c757d' }}>
                    {item.platform_short_name}
                  </div>
                )}
              </div>
            </td>
            <td style={{ padding: '8px 10px', fontSize: '13px' }}>
              {item.variant_type_code || 'Unknown'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {item.quantity}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace' }}>
              {item.market_price ? calculatorService.formatCurrency(item.market_price) : '-'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace' }}>
              {item.override_price ? calculatorService.formatCurrency(item.override_price) : '-'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace' }}>
              {item.markup_amount ? calculatorService.formatCurrency(item.markup_amount) : '-'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#28a745' }}>
              {item.estimated_sale_price ? calculatorService.formatCurrency(item.estimated_sale_price) : '-'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', color: '#dc3545' }}>
              {item.total_fees ? calculatorService.formatCurrency(item.total_fees) : '-'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {item.net_after_fees ? calculatorService.formatCurrency(item.net_after_fees) : '-'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#007bff' }}>
              {item.calculated_purchase_price ? calculatorService.formatCurrency(item.calculated_purchase_price) : '-'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {item.estimated_sale_price && item.calculated_purchase_price && item.total_fees ? (
                <span style={{ 
                  color: calculatorService.getProfitMarginColor(
                    calculatorService.calculateProfitMargin(
                      item.estimated_sale_price, 
                      item.calculated_purchase_price, 
                      item.total_fees
                    )
                  )
                }}>
                  {calculatorService.formatPercentage(
                    calculatorService.calculateProfitMargin(
                      item.estimated_sale_price, 
                      item.calculated_purchase_price, 
                      item.total_fees
                    )
                  )}
                </span>
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
import React, { useState } from 'react';
import { 
  Source
} from '../types/api';
import {
  CalculatorSessionDetail,
  ConvertToPORequest
} from '../types/calculator';
import { calculatorService } from '../services/calculatorService';

interface ConvertToPOModalProps {
  session: CalculatorSessionDetail;
  sources: Source[];
  onConvert: (poData: ConvertToPORequest) => void;
  onCancel: () => void;
  loading: boolean;
}

const ConvertToPOModal: React.FC<ConvertToPOModalProps> = ({
  session,
  sources,
  onConvert,
  onCancel,
  loading
}) => {
  const [formData, setFormData] = useState<ConvertToPORequest>({
    po_date_purchased: new Date().toISOString().split('T')[0],
    external_order_number: '',
    notes: `Converted from calculator session: ${session.session_name || 'Unnamed Session'}`
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConvert(formData);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        padding: '24px',
        minWidth: '500px',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px',
          paddingBottom: '12px',
          borderBottom: '1px solid #dee2e6'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#1d1d1f' }}>
            Convert to Purchase Order
          </h2>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: '#6c757d',
              cursor: 'pointer',
              padding: '0',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Session Summary */}
        <div style={{ 
          background: '#f8f9fa', 
          padding: '16px', 
          borderRadius: '4px', 
          marginBottom: '20px',
          border: '1px solid #e9ecef'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#495057' }}>
            Session Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
            <div>
              <strong>Session:</strong> {session.session_name || 'Unnamed Session'}
            </div>
            <div>
              <strong>Items:</strong> {session.total_items}
            </div>
            <div>
              <strong>Est. Revenue:</strong> {calculatorService.formatCurrency(session.total_estimated_revenue || 0)}
            </div>
            <div>
              <strong>Max Purchase:</strong> {calculatorService.formatCurrency(session.total_purchase_price || 0)}
            </div>
            <div>
              <strong>Expected Profit:</strong> {calculatorService.formatCurrency(session.expected_profit || 0)}
            </div>
            <div>
              <strong>Profit Margin:</strong> 
              <span style={{ 
                color: calculatorService.getProfitMarginColor(session.expected_profit_margin || 0),
                fontWeight: 'bold',
                marginLeft: '4px'
              }}>
                {calculatorService.formatPercentage(session.expected_profit_margin || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '16px' }}>
            
            {/* Purchase Date */}
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: 'bold', 
                color: '#495057', 
                marginBottom: '6px' 
              }}>
                Purchase Date
              </label>
              <input
                type="date"
                name="po_date_purchased"
                value={formData.po_date_purchased}
                onChange={handleInputChange}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                required
              />
            </div>

            {/* External Order Number */}
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: 'bold', 
                color: '#495057', 
                marginBottom: '6px' 
              }}>
                External Order Number (Optional)
              </label>
              <input
                type="text"
                name="external_order_number"
                value={formData.external_order_number}
                onChange={handleInputChange}
                placeholder="eBay order #, etc."
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: 'bold', 
                color: '#495057', 
                marginBottom: '6px' 
              }}>
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '12px', 
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #dee2e6'
          }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
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
              {loading ? 'Converting...' : 'Create Purchase Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConvertToPOModal;
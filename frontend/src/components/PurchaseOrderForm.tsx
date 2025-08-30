import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { POCreate, POResponse, Source, PaymentMethod } from '../types/api';

const PurchaseOrderForm: React.FC = () => {
  const [formData, setFormData] = useState<POCreate>({
    source_id: 0,
    date_purchased: new Date().toISOString().split('T')[0],
    payment_method_id: undefined,
    external_order_number: '',
    subtotal: 0,
    tax: 0,
    shipping: 0,
    fees: 0,
    discounts: 0,
    notes: '',
  });

  const [sources, setSources] = useState<Source[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<POResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [sourcesData, paymentMethodsData] = await Promise.all([
          apiService.getSources(),
          apiService.getPaymentMethods(),
        ]);
        setSources(sourcesData);
        setPaymentMethods(paymentMethodsData);
        
        if (sourcesData.length > 0) {
          setFormData(prev => ({ ...prev, source_id: sourcesData[0].source_id }));
        }
      } catch (err) {
        setError(`Failed to load form data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    loadLookups();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await apiService.createPurchaseOrder(formData);
      setSuccess(result);
      
      // Reset form
      setFormData({
        source_id: sources.length > 0 ? sources[0].source_id : 0,
        date_purchased: new Date().toISOString().split('T')[0],
        payment_method_id: undefined,
        external_order_number: '',
        subtotal: 0,
        tax: 0,
        shipping: 0,
        fees: 0,
        discounts: 0,
        notes: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  const totalCost = formData.subtotal + formData.tax + formData.shipping + formData.fees - formData.discounts;

  return (
    <div className="form-container">
      <h2>Create Purchase Order</h2>
      
      {success && (
        <div className="success-message">
          <strong>Purchase Order Created Successfully!</strong><br />
          PO Number: {success.po_number}<br />
          PO ID: {success.purchase_order_id}<br />
          Total Cost: ${success.total_cost.toFixed(2)}
        </div>
      )}
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="source_id">Source *</label>
            <select
              id="source_id"
              name="source_id"
              value={formData.source_id}
              onChange={handleInputChange}
              required
            >
              {sources.map(source => (
                <option key={source.source_id} value={source.source_id}>
                  {source.name} ({source.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="date_purchased">Date Purchased</label>
            <input
              type="date"
              id="date_purchased"
              name="date_purchased"
              value={formData.date_purchased}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="payment_method_id">Payment Method</label>
            <select
              id="payment_method_id"
              name="payment_method_id"
              value={formData.payment_method_id || ''}
              onChange={handleInputChange}
            >
              <option value="">Select Payment Method</option>
              {paymentMethods.map(method => (
                <option key={method.payment_method_id} value={method.payment_method_id}>
                  {method.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="external_order_number">External Order Number</label>
            <input
              type="text"
              id="external_order_number"
              name="external_order_number"
              value={formData.external_order_number}
              onChange={handleInputChange}
              placeholder="e.g., eBay order number"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="subtotal">Subtotal ($)</label>
            <input
              type="number"
              id="subtotal"
              name="subtotal"
              value={formData.subtotal}
              onChange={handleInputChange}
              step="0.01"
              min="0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="tax">Tax ($)</label>
            <input
              type="number"
              id="tax"
              name="tax"
              value={formData.tax}
              onChange={handleInputChange}
              step="0.01"
              min="0"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="shipping">Shipping ($)</label>
            <input
              type="number"
              id="shipping"
              name="shipping"
              value={formData.shipping}
              onChange={handleInputChange}
              step="0.01"
              min="0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="fees">Fees ($)</label>
            <input
              type="number"
              id="fees"
              name="fees"
              value={formData.fees}
              onChange={handleInputChange}
              step="0.01"
              min="0"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="discounts">Discounts ($)</label>
          <input
            type="number"
            id="discounts"
            name="discounts"
            value={formData.discounts}
            onChange={handleInputChange}
            step="0.01"
            min="0"
          />
        </div>

        <div className="form-group">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="Additional notes about this purchase order..."
          />
        </div>

        <div className="total-cost">
          Total Cost: ${totalCost.toFixed(2)}
        </div>

        <button
          type="submit"
          className="submit-button"
          disabled={loading || formData.source_id === 0}
        >
          {loading && <span className="loading-spinner"></span>}
          {loading ? 'Creating Purchase Order...' : 'Create Purchase Order'}
        </button>
      </form>
    </div>
  );
};

export default PurchaseOrderForm;
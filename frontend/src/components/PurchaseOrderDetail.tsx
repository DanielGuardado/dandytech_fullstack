import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { PODetail, Source, PaymentMethod } from '../types/api';

const PurchaseOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [purchaseOrder, setPurchaseOrder] = useState<PODetail | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const [poResponse, lookupsResponse] = await Promise.all([
          apiService.getPurchaseOrder(parseInt(id)),
          apiService.getLookups()
        ]);
        
        setPurchaseOrder(poResponse);
        setSources(lookupsResponse.sources);
        setPaymentMethods(lookupsResponse.payment_methods);
        
        // Debug: log the line items to see what data we're getting
        console.log('PO Response:', poResponse);
        console.log('Line items:', poResponse.lines);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load purchase order');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const getSourceName = (sourceId: number): string => {
    const source = sources.find(s => s.source_id === sourceId);
    return source ? source.name : `Source ${sourceId}`;
  };

  const getPaymentMethodName = (paymentMethodId?: number): string => {
    if (!paymentMethodId) return 'Not specified';
    const method = paymentMethods.find(pm => pm.payment_method_id === paymentMethodId);
    return method ? method.display_name : `Payment Method ${paymentMethodId}`;
  };

  const getStatusBadge = (status: string, isLocked: boolean) => {
    if (isLocked) {
      return <span className="status-badge locked">Locked</span>;
    }
    
    switch (status.toLowerCase()) {
      case 'open':
        return <span className="status-badge open">Open</span>;
      case 'partially_received':
        return <span className="status-badge partial">Partial</span>;
      case 'received':
        return <span className="status-badge received">Received</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleBack = () => {
    navigate('/purchase-orders');
  };

  const handleEdit = () => {
    // Future functionality to edit PO
    console.log('Edit PO');
  };

  if (loading) {
    return (
      <div className="po-detail-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          Loading purchase order...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="po-detail-container">
        <div className="error-state">
          <div className="error-message">{error}</div>
          <button onClick={handleBack} className="back-button">
            ← Back to Purchase Orders
          </button>
        </div>
      </div>
    );
  }

  if (!purchaseOrder) {
    return (
      <div className="po-detail-container">
        <div className="error-state">
          <div className="error-message">Purchase order not found</div>
          <button onClick={handleBack} className="back-button">
            ← Back to Purchase Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="po-detail-container">
      <div className="po-detail-header">
        <div className="header-top">
          <button onClick={handleBack} className="back-button">
            ← Back to Purchase Orders
          </button>
          <div className="header-actions">
            {!purchaseOrder.is_locked && (
              <button onClick={handleEdit} className="edit-button">
                Edit
              </button>
            )}
          </div>
        </div>
        
        <div className="header-main">
          <div className="po-title">
            <h1>Purchase Order {purchaseOrder.po_number}</h1>
            {getStatusBadge(purchaseOrder.status, purchaseOrder.is_locked)}
          </div>
          <div className="po-meta">
            <div className="meta-item">
              <span className="meta-label">Source:</span>
              <span className="meta-value">{getSourceName(purchaseOrder.source_id)}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Created:</span>
              <span className="meta-value">{formatDate(purchaseOrder.created_at)}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Updated:</span>
              <span className="meta-value">{formatDate(purchaseOrder.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="po-detail-content">
        <div className="po-info-grid">
          <div className="info-section">
            <h3>Order Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <label>Payment Method</label>
                <span>{getPaymentMethodName(purchaseOrder.payment_method_id)}</span>
              </div>
              <div className="info-item">
                <label>External Order Number</label>
                <span>{purchaseOrder.external_order_number || 'Not specified'}</span>
              </div>
            </div>
          </div>

          <div className="cost-section">
            <h3>Cost Breakdown</h3>
            <div className="cost-grid">
              <div className="cost-item">
                <label>Subtotal</label>
                <span>${purchaseOrder.subtotal.toFixed(2)}</span>
              </div>
              <div className="cost-item">
                <label>Tax</label>
                <span>${purchaseOrder.tax.toFixed(2)}</span>
              </div>
              <div className="cost-item">
                <label>Shipping</label>
                <span>${purchaseOrder.shipping.toFixed(2)}</span>
              </div>
              <div className="cost-item">
                <label>Fees</label>
                <span>${purchaseOrder.fees.toFixed(2)}</span>
              </div>
              <div className="cost-item">
                <label>Discounts</label>
                <span>-${purchaseOrder.discounts.toFixed(2)}</span>
              </div>
              <div className="cost-item total">
                <label>Total</label>
                <span>${purchaseOrder.total_cost.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {purchaseOrder.notes && (
          <div className="notes-section">
            <h3>Notes</h3>
            <div className="notes-content">
              {purchaseOrder.notes}
            </div>
          </div>
        )}

        <div className="line-items-section">
          <h3>Line Items ({purchaseOrder.lines.length})</h3>
          {purchaseOrder.lines.length === 0 ? (
            <div className="empty-line-items">
              <p>No line items have been added to this purchase order.</p>
            </div>
          ) : (
            <div className="line-items-table">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>Qty Expected</th>
                    <th>Qty Received</th>
                    <th>Allocation Basis</th>
                    <th>Source</th>
                    <th>Unit Cost</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrder.lines.map((line) => (
                    <tr key={line.purchase_order_item_id}>
                      <td>{line.product_title || `Product ${line.catalog_product_id}`}</td>
                      <td>{line.variant_display_name || `Variant ${line.variant_id}`}</td>
                      <td>{line.quantity_expected}</td>
                      <td>{line.quantity_received}</td>
                      <td>${line.allocation_basis.toFixed(2)}</td>
                      <td>
                        {line.allocation_basis_source === 'pricecharting' ? 'PriceCharting' :
                         line.allocation_basis_source === 'ebay_sold' ? 'eBay Sold' :
                         line.cost_assignment_method === 'manual' ? 'Manual' : 'Other'}
                      </td>
                      <td>
                        {line.allocated_unit_cost 
                          ? `$${line.allocated_unit_cost.toFixed(2)}`
                          : 'Pending'
                        }
                      </td>
                      <td>
                        {line.allocated_unit_cost 
                          ? `$${(line.allocated_unit_cost * line.quantity_expected).toFixed(2)}`
                          : `~$${(line.allocation_basis * line.quantity_expected).toFixed(2)}`
                        }
                      </td>
                      <td>
                        <span className={`receive-status ${line.receive_status}`}>
                          {line.receive_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderDetail;
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { InventoryItem, AttributeProfile, InventoryAdjustmentRequest } from '../types/api';

interface InventoryRowDetailProps {
  itemId: number | null;
  onClose: () => void;
  onItemUpdated?: (item: InventoryItem) => void;
}

const InventoryRowDetail: React.FC<InventoryRowDetailProps> = ({ itemId, onClose, onItemUpdated }) => {
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [profile, setProfile] = useState<AttributeProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingAttributes, setEditingAttributes] = useState(false);
  const [attributes, setAttributes] = useState<Record<string, any>>({});
  const [adjustmentData, setAdjustmentData] = useState<{
    delta: string;
    reason: string;
    status?: string;
    notes: string;
  }>({
    delta: '0',
    reason: 'correction',
    notes: ''
  });

  useEffect(() => {
    if (itemId) {
      loadItemDetail();
    }
  }, [itemId]);

  const loadItemDetail = async () => {
    if (!itemId) return;

    try {
      setLoading(true);
      setError(null);
      const itemDetail = await apiService.getInventoryItem(itemId);
      setItem(itemDetail);
      
      // Parse unit_attributes_json if it's a string
      const parsedAttributes = (() => {
        if (typeof itemDetail.unit_attributes_json === 'string') {
          try {
            return JSON.parse(itemDetail.unit_attributes_json);
          } catch (e) {
            console.warn('Failed to parse unit_attributes_json', e);
            return {};
          }
        }
        return itemDetail.unit_attributes_json || {};
      })();
      
      setAttributes(parsedAttributes);
      
      // Load profile if available
      if (itemDetail.profile_id) {
        // For now, we'll assume profile is embedded or fetch separately
        // In a full implementation, you might need a separate API call
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item details');
    } finally {
      setLoading(false);
    }
  };

  const handleAttributeSave = async () => {
    if (!item) return;

    try {
      setLoading(true);
      await apiService.updateInventoryItemAttributes(item.inventory_item_id, {
        unit_attributes_json: attributes
      });
      
      // Reload item to get updated data
      await loadItemDetail();
      setEditingAttributes(false);
      
      if (onItemUpdated && item) {
        onItemUpdated({ ...item, unit_attributes_json: attributes });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save attributes');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustment = async () => {
    if (!item) return;

    try {
      setLoading(true);
      const adjustmentRequest: InventoryAdjustmentRequest = {
        delta: parseInt(adjustmentData.delta) || 0,
        reason: adjustmentData.reason as any,
        set_status: adjustmentData.status as any || undefined,
        notes: adjustmentData.notes || undefined,
        auto_archive_when_zero: true
      };

      const result = await apiService.adjustInventoryItem(item.inventory_item_id, adjustmentRequest);
      
      // Reload item to get updated data
      await loadItemDetail();
      
      // Reset adjustment form
      setAdjustmentData({
        delta: '0',
        reason: 'correction',
        notes: ''
      });
      
      alert(`Adjustment applied successfully. New quantity: ${result.quantity}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply adjustment');
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyles = (status: string) => {
    const styles = {
      'Active': { background: '#d4edda', color: '#155724' },
      'Pending': { background: '#fff3cd', color: '#856404' },
      'Damaged': { background: '#f8d7da', color: '#721c24' },
      'Archived': { background: '#e2e3e5', color: '#383d41' }
    };
    return styles[status as keyof typeof styles] || styles.Pending;
  };

  if (!itemId) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '400px',
      height: '100vh',
      background: '#fff',
      boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        background: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Item Details</h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#6c757d'
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
            Loading...
          </div>
        )}

        {error && (
          <div style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
            border: '1px solid #f5c6cb'
          }}>
            {error}
          </div>
        )}

        {item && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Basic Info */}
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#495057' }}>Basic Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                <div><strong>Product:</strong> {item.product_title}</div>
                <div><strong>Brand:</strong> {item.product_brand || '—'}</div>
                <div><strong>UPC:</strong> {item.product_upc || '—'}</div>
                <div><strong>Platform:</strong> {item.platform_short || '—'}</div>
                <div><strong>Variant:</strong> {item.variant_type_code}</div>
                <div><strong>PO Number:</strong> {item.po_number}</div>
                <div>
                  <strong>Status:</strong>{' '}
                  <span style={{
                    ...getStatusStyles(item.status),
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {item.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Inventory Details */}
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#495057' }}>Inventory Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                <div><strong>Quantity:</strong> {item.quantity}</div>
                <div><strong>Available:</strong> {item.available}</div>
                <div><strong>List Price:</strong> {item.list_price ? `$${item.list_price.toFixed(2)}` : '—'}</div>
                <div><strong>Cost:</strong> {item.allocated_unit_cost ? `$${item.allocated_unit_cost.toFixed(2)}` : '—'}</div>
                <div><strong>SKU:</strong> {item.seller_sku || '—'}</div>
                <div><strong>Location:</strong> {item.location || '—'}</div>
                <div><strong>Condition:</strong> {item.condition_grade_id || '—'}</div>
                <div><strong>Title Suffix:</strong> {item.title_suffix || '—'}</div>
              </div>
            </div>

            {/* Attributes */}
            {item.unit_attributes_json && Object.keys(item.unit_attributes_json).length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#495057' }}>Attributes</h3>
                  <button
                    onClick={() => setEditingAttributes(!editingAttributes)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      background: editingAttributes ? '#6c757d' : '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {editingAttributes ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {editingAttributes ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(attributes).map(([key, value]) => (
                      <div key={key}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
                          {key.replace(/_/g, ' ')}
                        </label>
                        {typeof value === 'boolean' ? (
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => setAttributes(prev => ({ ...prev, [key]: e.target.checked }))}
                          />
                        ) : (
                          <input
                            type="text"
                            value={value?.toString() || ''}
                            onChange={(e) => setAttributes(prev => ({ ...prev, [key]: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              border: '1px solid #dee2e6',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                          />
                        )}
                      </div>
                    ))}
                    <button
                      onClick={handleAttributeSave}
                      disabled={loading}
                      style={{
                        padding: '8px 16px',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Save Attributes
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                    {Object.entries(item.unit_attributes_json).map(([key, value]) => (
                      <div key={key}>
                        <strong>{key.replace(/_/g, ' ')}:</strong> {value?.toString() || '—'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quantity Adjustment */}
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#495057' }}>Quantity Adjustment</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
                    Change (+/-)
                  </label>
                  <input
                    type="number"
                    value={adjustmentData.delta}
                    onChange={(e) => setAdjustmentData(prev => ({ ...prev, delta: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
                    Reason
                  </label>
                  <select
                    value={adjustmentData.reason}
                    onChange={(e) => setAdjustmentData(prev => ({ ...prev, reason: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="correction">Correction</option>
                    <option value="damage">Damage</option>
                    <option value="loss">Loss</option>
                    <option value="found">Found</option>
                    <option value="cycle_count">Cycle Count</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
                    New Status (Optional)
                  </label>
                  <select
                    value={adjustmentData.status || ''}
                    onChange={(e) => setAdjustmentData(prev => ({ ...prev, status: e.target.value || undefined }))}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Keep Current</option>
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
                    Notes
                  </label>
                  <textarea
                    value={adjustmentData.notes}
                    onChange={(e) => setAdjustmentData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <button
                  onClick={handleAdjustment}
                  disabled={loading || adjustmentData.delta === '0'}
                  style={{
                    padding: '8px 16px',
                    background: loading || adjustmentData.delta === '0' ? '#6c757d' : '#ffc107',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading || adjustmentData.delta === '0' ? 'not-allowed' : 'pointer'
                  }}
                >
                  Apply Adjustment
                </button>
              </div>
            </div>

            {/* Timestamps */}
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#495057' }}>Timeline</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                <div><strong>Created:</strong> {new Date(item.created_at).toLocaleString()}</div>
                <div><strong>Updated:</strong> {new Date(item.updated_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryRowDetail;
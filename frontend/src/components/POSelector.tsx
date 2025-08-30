import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { PORow, Source } from '../types/api';

interface POSelectorProps {
  currentPoId?: number | null;
  onPoSelect: (po: PORow | null) => void;
  sources: Source[];
}

interface POWithSourceName extends PORow {
  source_name?: string;
}

const POSelector: React.FC<POSelectorProps> = ({ currentPoId, onPoSelect, sources }) => {
  const [openPOs, setOpenPOs] = useState<POWithSourceName[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadOpenPOs();
  }, []);

  const loadOpenPOs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getPurchaseOrders({
        is_locked: false,
        limit: 50 // Get more open POs
      });
      
      // Enrich POs with source names
      const posWithSourceNames = response.items.map(po => {
        const source = sources.find(s => s.source_id === po.source_id);
        return {
          ...po,
          source_name: source ? `${source.name} (${source.code})` : `Source ${po.source_id}`
        };
      });
      
      setOpenPOs(posWithSourceNames);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load POs');
    } finally {
      setLoading(false);
    }
  };

  const handlePoSelect = (po: POWithSourceName | null) => {
    onPoSelect(po);
    setIsOpen(false);
  };

  const currentPO = openPOs.find(po => po.purchase_order_id === currentPoId);

  const formatPoDisplay = (po: POWithSourceName) => {
    const date = new Date(po.created_at).toLocaleDateString();
    // Note: PORow doesn't include lines, so we can't show item count here
    return `${po.po_number} - ${po.source_name} - ${date} - $${po.total_cost.toFixed(2)}`;
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          padding: '8px 12px',
          background: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          minHeight: '32px'
        }}
      >
        <div style={{ flex: 1 }}>
          {currentPO ? (
            <div>
              <strong>{currentPO.po_number}</strong> - {currentPO.source_name}
              <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '2px' }}>
                {new Date(currentPO.created_at).toLocaleDateString()} - $${currentPO.total_cost.toFixed(2)}
              </div>
            </div>
          ) : (
            <div style={{ color: '#6c757d' }}>
              {loading ? 'Loading...' : 'Select or Create Purchase Order'}
            </div>
          )}
        </div>
        <div style={{
          fontSize: '14px',
          color: '#6c757d',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>
          ▼
        </div>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#fff',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {/* Create New Option */}
          <div
            onClick={() => handlePoSelect(null)}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e9ecef',
              cursor: 'pointer',
              background: currentPoId === null ? '#e3f2fd' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (currentPoId !== null) {
                e.currentTarget.style.background = '#f8f9fa';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPoId !== null) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#28a745',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              +
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Create New Purchase Order</div>
              <div style={{ fontSize: '10px', color: '#6c757d' }}>Start fresh with a new PO</div>
            </div>
          </div>

          {/* Existing POs */}
          {error ? (
            <div style={{ 
              padding: '16px', 
              color: '#dc3545', 
              fontSize: '12px',
              textAlign: 'center'
            }}>
              {error}
            </div>
          ) : openPOs.length === 0 ? (
            <div style={{ 
              padding: '16px', 
              color: '#6c757d', 
              fontSize: '12px',
              textAlign: 'center'
            }}>
              {loading ? 'Loading open POs...' : 'No open purchase orders found'}
            </div>
          ) : (
            openPOs.map((po) => (
              <div
                key={po.purchase_order_id}
                onClick={() => handlePoSelect(po)}
                style={{
                  padding: '12px 16px',
                  borderBottom: openPOs[openPOs.length - 1].purchase_order_id === po.purchase_order_id ? 'none' : '1px solid #e9ecef',
                  cursor: 'pointer',
                  background: currentPoId === po.purchase_order_id ? '#e3f2fd' : 'transparent',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
                onMouseEnter={(e) => {
                  if (currentPoId !== po.purchase_order_id) {
                    e.currentTarget.style.background = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPoId !== po.purchase_order_id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: po.status === 'open' ? '#28a745' : '#6c757d',
                  marginTop: '4px',
                  flexShrink: 0
                }} />
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: 'bold',
                    marginBottom: '2px'
                  }}>
                    {po.po_number}
                  </div>
                  
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6c757d',
                    marginBottom: '4px'
                  }}>
                    {po.source_name} • {new Date(po.created_at).toLocaleDateString()}
                  </div>
                  
                  <div style={{ 
                    fontSize: '10px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      background: '#e9ecef',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      fontWeight: 'bold'
                    }}>
                      ${po.total_cost.toFixed(2)}
                    </span>
                    
                    <span style={{ color: '#6c757d' }}>
                      {po.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default POSelector;
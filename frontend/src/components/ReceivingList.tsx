import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { PORow, POListResponse, Source } from '../types/api';

const ReceivingList: React.FC = () => {
  const navigate = useNavigate();
  const [purchaseOrders, setPurchaseOrders] = useState<PORow[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [selectedRow, setSelectedRow] = useState<number>(0);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [posResponse, sourcesResponse] = await Promise.all([
          apiService.getLockedPurchaseOrders({ limit: 50, offset: 0 }),
          apiService.getLookups()
        ]);
        
        setPurchaseOrders(posResponse.items);
        setSources(sourcesResponse.sources);
        setTotal(posResponse.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load purchase orders');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const getSourceName = (sourceId: number): string => {
    const source = sources.find(s => s.source_id === sourceId);
    return source ? source.name : `Source ${sourceId}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleRowClick = (poId: number) => {
    navigate(`/receiving/${poId}`);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (purchaseOrders.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedRow(prev => Math.min(prev + 1, purchaseOrders.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedRow(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (purchaseOrders[selectedRow]) {
          handleRowClick(purchaseOrders[selectedRow].purchase_order_id);
        }
        break;
    }
  }, [purchaseOrders, selectedRow]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (rowRefs.current[selectedRow]) {
      rowRefs.current[selectedRow]?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }
  }, [selectedRow]);

  if (loading) {
    return (
      <div style={{ 
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px'
      }}>
        <div>Loading purchase orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        flexDirection: 'column'
      }}>
        <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '16px', 
      height: '100vh', 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#f8f9fa',
        padding: '16px 20px',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Receiving</h1>
          <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
            {total} locked purchase orders ready to receive
          </p>
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: '#6c757d',
          background: '#fff',
          padding: '6px 12px',
          borderRadius: '4px',
          border: '1px solid #dee2e6'
        }}>
          ↑↓: Navigate | Enter: Start Receiving
        </div>
      </div>

      {purchaseOrders.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
          <h3 style={{ margin: '0 0 8px 0', color: '#495057' }}>No Purchase Orders Ready</h3>
          <p style={{ margin: 0, color: '#6c757d' }}>
            Create and lock purchase orders to enable receiving
          </p>
        </div>
      ) : (
        <div style={{
          flex: 1,
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          background: '#fff',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          
          {/* Table Header */}
          <div style={{
            padding: '12px 16px',
            background: '#f8f9fa',
            borderBottom: '1px solid #dee2e6',
            fontWeight: 'bold',
            fontSize: '14px',
            color: '#495057',
            display: 'grid',
            gridTemplateColumns: '120px 1fr 120px 120px 120px',
            gap: '16px'
          }}>
            <div>PO Number</div>
            <div>Source</div>
            <div>Date Created</div>
            <div>Total Cost</div>
            <div>Status</div>
          </div>

          {/* Table Body */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {purchaseOrders.map((po, index) => (
              <div
                key={po.purchase_order_id}
                ref={el => rowRefs.current[index] = el}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 120px 120px 120px',
                  gap: '16px',
                  padding: '12px 16px',
                  borderBottom: '1px solid #f1f3f4',
                  backgroundColor: selectedRow === index ? '#e3f2fd' : 'transparent',
                  border: selectedRow === index ? '2px solid #1976d2' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '14px'
                }}
                onClick={() => {
                  setSelectedRow(index);
                  handleRowClick(po.purchase_order_id);
                }}
                onMouseEnter={() => setSelectedRow(index)}
                tabIndex={0}
                role="row"
                aria-selected={selectedRow === index}
              >
                <div style={{ fontWeight: 'bold', color: '#1976d2' }}>
                  {po.po_number}
                </div>
                <div title={getSourceName(po.source_id)}>
                  {getSourceName(po.source_id)}
                </div>
                <div>
                  {formatDate(po.created_at)}
                </div>
                <div style={{ fontWeight: 'bold' }}>
                  ${po.total_cost.toFixed(2)}
                </div>
                <div>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    background: po.is_locked ? '#28a745' : '#ffc107',
                    color: 'white'
                  }}>
                    {po.is_locked ? 'Locked' : po.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 16px',
            background: '#f8f9fa',
            borderTop: '1px solid #dee2e6',
            fontSize: '12px',
            color: '#6c757d',
            textAlign: 'center'
          }}>
            Showing {purchaseOrders.length} of {total} purchase orders
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceivingList;
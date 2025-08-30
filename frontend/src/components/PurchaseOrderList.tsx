import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { PORow, POListResponse, Source } from '../types/api';

interface PurchaseOrderListProps {
  limit?: number;
  showTitle?: boolean;
  showViewAll?: boolean;
  focusContext?: 'actions' | 'table';
  onFocusChange?: (context: 'actions' | 'table') => void;
}

const PurchaseOrderList: React.FC<PurchaseOrderListProps> = ({ 
  limit, 
  showTitle = true,
  showViewAll = false,
  focusContext = 'table',
  onFocusChange
}) => {
  const navigate = useNavigate();
  const [purchaseOrders, setPurchaseOrders] = useState<PORow[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [selectedRow, setSelectedRow] = useState<number>(0);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [posResponse, sourcesResponse] = await Promise.all([
          apiService.getPurchaseOrders({ limit, offset: 0 }),
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
  }, [limit]);

  const getSourceName = (sourceId: number): string => {
    const source = sources.find(s => s.source_id === sourceId);
    return source ? source.name : `Source ${sourceId}`;
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
    return new Date(dateString).toLocaleDateString();
  };

  const handleRowClick = (poId: number) => {
    navigate(`/purchase-orders/${poId}`);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (purchaseOrders.length === 0 || focusContext !== 'table') return;

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
      case 'n':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleCreateNew();
        }
        break;
    }
  }, [purchaseOrders, selectedRow, focusContext]);

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

  const handleCreateNew = () => {
    navigate('/purchase-orders/create');
  };

  const handleViewAll = () => {
    navigate('/purchase-orders');
  };

  if (loading) {
    return (
      <div className="po-list-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          Loading purchase orders...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="po-list-container">
        <div className="error-state">
          <div className="error-message">{error}</div>
          <button onClick={() => window.location.reload()} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="po-list-container">
      {showTitle && (
        <div className="po-list-header">
          <div>
            <h2>Purchase Orders</h2>
            {total > 0 && <p className="po-list-subtitle">{total} total orders</p>}
          </div>
          <button onClick={handleCreateNew} className="create-po-button">
            + New Purchase Order
          </button>
        </div>
      )}

      {purchaseOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No Purchase Orders</h3>
          <p>Create your first purchase order to get started</p>
          <button onClick={handleCreateNew} className="create-first-button">
            Create Purchase Order
          </button>
        </div>
      ) : (
        <>
          <div className="po-table-container">
            <div className="table-controls">
              <div className="keyboard-hints">
                <span>{focusContext === 'table' ? '↑↓ Navigate | Enter to Open' : 'Tab to focus table'} | Ctrl+N New PO</span>
              </div>
              <div className="table-info">
                Showing {purchaseOrders.length} of {total} orders
              </div>
            </div>
            <table className="po-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Source</th>
                  <th>Date Created</th>
                  <th>Status</th>
                  <th>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po, index) => (
                  <tr 
                    key={po.purchase_order_id}
                    ref={el => rowRefs.current[index] = el}
                    className={`po-table-row ${
                      selectedRow === index ? 'selected' : ''
                    }`}
                    style={{
                      backgroundColor: selectedRow === index && focusContext === 'table' ? '#e3f2fd' : 'transparent',
                      border: selectedRow === index && focusContext === 'table' ? '2px solid #1976d2' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => {
                      onFocusChange?.('table');
                      setSelectedRow(index);
                      handleRowClick(po.purchase_order_id);
                    }}
                    onMouseEnter={() => {
                      onFocusChange?.('table');
                      setSelectedRow(index);
                    }}
                    tabIndex={0}
                    role="row"
                    aria-selected={selectedRow === index}
                  >
                    <td className="po-number" title={`Purchase Order #${po.po_number}`}>
                      {po.po_number}
                    </td>
                    <td className="po-source" title={getSourceName(po.source_id)}>
                      {getSourceName(po.source_id)}
                    </td>
                    <td className="po-date" title={new Date(po.created_at).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}>
                      {formatDate(po.created_at)}
                    </td>
                    <td className="po-status">
                      {getStatusBadge(po.status, po.is_locked)}
                    </td>
                    <td className="po-total" title={`Total: $${po.total_cost.toFixed(2)}`}>
                      ${po.total_cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showViewAll && total > (limit || 0) && (
            <div className="po-list-footer">
              <button onClick={handleViewAll} className="view-all-button">
                View All {total} Purchase Orders →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PurchaseOrderList;
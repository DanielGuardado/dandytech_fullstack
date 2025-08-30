import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { StagingTemplateResponse, ReceivingItem, ReceivingCommitRequest } from '../types/api';

interface ReceivingGridProps {
  poId: number;
}

const ReceivingGrid: React.FC<ReceivingGridProps> = ({ poId }) => {
  const navigate = useNavigate();
  const [stagingData, setStagingData] = useState<StagingTemplateResponse | null>(null);
  const [receivingItems, setReceivingItems] = useState<ReceivingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedRow, setFocusedRow] = useState<number>(0);
  const [isCommitting, setIsCommitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize receiving items with prefilled quantities
  const initializeReceivingItems = (stagingItems: any[]): ReceivingItem[] => {
    return stagingItems.map(item => ({
      ...item,
      qty_to_receive: item.remaining, // PREFILL with remaining quantity!
      damaged: false,
      short: false,
      isModified: false
    }));
  };

  useEffect(() => {
    const loadStagingData = async () => {
      try {
        setLoading(true);
        const response = await apiService.getStagingTemplate(poId);
        setStagingData(response);
        setReceivingItems(initializeReceivingItems(response.items));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load receiving data');
      } finally {
        setLoading(false);
      }
    };

    loadStagingData();
  }, [poId]);

  // Focus management
  useEffect(() => {
    if (inputRefs.current[focusedRow]) {
      inputRefs.current[focusedRow]?.focus();
      inputRefs.current[focusedRow]?.select();
    }
  }, [focusedRow]);

  const updateItem = (index: number, updates: Partial<ReceivingItem>) => {
    setReceivingItems(prev => prev.map((item, i) => 
      i === index 
        ? { ...item, ...updates, isModified: true }
        : item
    ));
  };

  const handleQuantityChange = (index: number, value: string) => {
    const qty = value === '' ? 0 : Math.max(0, parseInt(value) || 0);
    const maxQty = receivingItems[index].remaining;
    const finalQty = Math.min(qty, maxQty);
    updateItem(index, { qty_to_receive: finalQty });
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (receivingItems.length === 0) return;

    const activeElement = document.activeElement;
    const isInputFocused = activeElement?.tagName === 'INPUT';

    // Global shortcuts
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleCommitReceiving();
      return;
    }

    // Navigation shortcuts (only when not typing in input)
    if (!isInputFocused || (isInputFocused && e.key === 'Tab')) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedRow(prev => Math.min(prev + 1, receivingItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedRow(prev => Math.max(prev - 1, 0));
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            setFocusedRow(prev => Math.max(prev - 1, 0));
          } else {
            setFocusedRow(prev => Math.min(prev + 1, receivingItems.length - 1));
          }
          break;
        case 'Enter':
          if (!isInputFocused) {
            e.preventDefault();
            // Quick receive 1 item
            const item = receivingItems[focusedRow];
            if (item.qty_to_receive === 0 && item.remaining > 0) {
              updateItem(focusedRow, { qty_to_receive: 1 });
            }
            // Move to next row
            setFocusedRow(prev => Math.min(prev + 1, receivingItems.length - 1));
          }
          break;
        case '0':
          if (!isInputFocused) {
            e.preventDefault();
            updateItem(focusedRow, { qty_to_receive: 0 });
          }
          break;
        case 'd':
        case 'D':
          if (!isInputFocused) {
            e.preventDefault();
            const currentItem = receivingItems[focusedRow];
            updateItem(focusedRow, { damaged: !currentItem.damaged });
          }
          break;
        case 's':
        case 'S':
          if (!isInputFocused) {
            e.preventDefault();
            const currentItem = receivingItems[focusedRow];
            updateItem(focusedRow, { short: !currentItem.short });
          }
          break;
      }
    }
  }, [receivingItems, focusedRow]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleCommitReceiving = async () => {
    if (!stagingData || isCommitting) return;

    const itemsToReceive = receivingItems.filter(item => item.qty_to_receive > 0);
    
    if (itemsToReceive.length === 0) {
      alert('No items to receive. Please set quantities greater than 0.');
      return;
    }

    try {
      setIsCommitting(true);
      
      const commitRequest: ReceivingCommitRequest = {
        purchase_order_id: stagingData.purchase_order_id,
        items: itemsToReceive.map(item => ({
          purchase_order_item_id: item.purchase_order_item_id,
          qty_to_receive: item.qty_to_receive,
          damaged: item.damaged,
          short: item.short,
          updated_at: item.updated_at
        }))
      };

      const response = await apiService.commitReceiving(commitRequest);
      
      // Show success and redirect
      alert(`Successfully received ${itemsToReceive.length} items! Created ${response.inventory_item_ids.length} inventory items.`);
      navigate('/receiving');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit receiving');
    } finally {
      setIsCommitting(false);
    }
  };

  const resetToExpected = () => {
    if (stagingData) {
      setReceivingItems(initializeReceivingItems(stagingData.items));
      setFocusedRow(0);
    }
  };

  const clearAll = () => {
    setReceivingItems(prev => prev.map(item => ({
      ...item,
      qty_to_receive: 0,
      damaged: false,
      short: false,
      isModified: true
    })));
  };

  const totalExpected = receivingItems.reduce((sum, item) => sum + item.remaining, 0);
  const totalToReceive = receivingItems.reduce((sum, item) => sum + item.qty_to_receive, 0);
  const progressPercent = totalExpected > 0 ? Math.round((totalToReceive / totalExpected) * 100) : 0;

  if (loading) {
    return (
      <div style={{ 
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '50vh'
      }}>
        Loading receiving data...
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
        height: '50vh',
        flexDirection: 'column'
      }}>
        <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>
        <button onClick={() => navigate('/receiving')}>Back to Receiving List</button>
      </div>
    );
  }

  if (!stagingData) return null;

  return (
    <div style={{ padding: '16px', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Receiving PO: {stagingData.po_number}</h1>
          <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>Total: {totalExpected} items | Ready: {totalToReceive}/{totalExpected} | Progress: {progressPercent}%</p>
        </div>
        <div style={{ fontSize: '12px', color: '#6c757d', background: '#fff', padding: '6px 12px', borderRadius: '4px', border: '1px solid #dee2e6' }}>
          Tab=Next | Enter=Receive 1 | 0=Zero | D=Damage | S=Short | Ctrl+Enter=Commit
        </div>
      </div>
      
      <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '8px', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6', fontWeight: 'bold', fontSize: '14px', color: '#495057', display: 'grid', gridTemplateColumns: '2fr 120px 80px 80px 80px 100px 40px 40px', gap: '12px', alignItems: 'center' }}>
          <div>Product</div>
          <div>Variant</div>
          <div>Expected</div>
          <div>Received</div>
          <div>Remaining</div>
          <div>Qty to Receive</div>
          <div>D</div>
          <div>S</div>
        </div>
        
        <div style={{ flex: 1, overflow: 'auto' }}>
          {receivingItems.map((item, index) => (
            <div key={item.purchase_order_item_id} style={{ display: 'grid', gridTemplateColumns: '2fr 120px 80px 80px 80px 100px 40px 40px', gap: '12px', padding: '8px 16px', borderBottom: '1px solid #f1f3f4', backgroundColor: focusedRow === index ? '#e3f2fd' : 'transparent', alignItems: 'center', fontSize: '14px' }}>
              <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_title}</div>
              <div>{item.variant_type_code}</div>
              <div>{item.quantity_expected}</div>
              <div>{item.quantity_received}</div>
              <div>{item.remaining}</div>
              <div>
                <input ref={el => inputRefs.current[index] = el} type="number" min="0" max={item.remaining} value={item.qty_to_receive} onChange={(e) => handleQuantityChange(index, e.target.value)} onFocus={() => setFocusedRow(index)} style={{ width: '80px', padding: '4px 8px', border: item.isModified ? '2px solid #ffc107' : '1px solid #dee2e6', borderRadius: '4px', fontSize: '14px', textAlign: 'center', background: item.qty_to_receive > 0 ? '#f0f9ff' : 'transparent' }} />
              </div>
              <div>
                <input type="checkbox" checked={item.damaged} onChange={(e) => updateItem(index, { damaged: e.target.checked })} style={{ transform: 'scale(1.2)' }} />
              </div>
              <div>
                <input type="checkbox" checked={item.short} onChange={(e) => updateItem(index, { short: e.target.checked })} style={{ transform: 'scale(1.2)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={clearAll} style={{ padding: '8px 16px', background: 'transparent', color: '#6c757d', border: '1px solid #dee2e6', borderRadius: '4px', cursor: 'pointer' }}>Clear All</button>
          <button onClick={resetToExpected} style={{ padding: '8px 16px', background: 'transparent', color: '#6c757d', border: '1px solid #dee2e6', borderRadius: '4px', cursor: 'pointer' }}>Reset to Expected</button>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ fontSize: '14px', color: '#6c757d' }}>Progress: {totalToReceive}/{totalExpected} items ({progressPercent}%)</div>
          <button onClick={() => navigate('/receiving')} style={{ padding: '8px 16px', background: 'transparent', color: '#6c757d', border: '1px solid #dee2e6', borderRadius: '4px', cursor: 'pointer' }}>Back</button>
          <button onClick={handleCommitReceiving} disabled={isCommitting || totalToReceive === 0} style={{ padding: '12px 24px', background: isCommitting ? '#6c757d' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: isCommitting ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
            {isCommitting ? 'Committing...' : `Commit Receiving (Ctrl+Enter)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceivingGrid;
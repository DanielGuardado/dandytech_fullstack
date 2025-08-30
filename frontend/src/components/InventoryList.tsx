import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import InventoryGrid from './InventoryGrid';
import InventoryRowDetail from './InventoryRowDetail';
import { InventoryItem, LookupsResponse } from '../types/api';
import { apiService } from '../services/api';

const InventoryList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>();
  const [lookups, setLookups] = useState<LookupsResponse | null>(null);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const lookupsResponse = await apiService.getLookups();
        setLookups(lookupsResponse);
      } catch (err) {
        console.error('Failed to load lookups:', err);
      }
    };

    loadLookups();
    
    // Handle URL query parameters
    const filterParam = searchParams.get('filter');
    if (filterParam === 'low-stock') {
      // For low stock, we could add a special filter to the InventoryGrid
      // For now, we'll show Active items which is most relevant
      setStatusFilter('Active');
    }
  }, [searchParams]);

  const handleItemUpdated = (item: InventoryItem) => {
    // This could trigger a refresh of the grid if needed
    console.log('Item updated:', item);
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'Active', label: 'Active' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Damaged', label: 'Damaged' },
    { value: 'Archived', label: 'Archived' }
  ];

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      {/* Main Content */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
        paddingRight: selectedItemId ? '400px' : '0',
        transition: 'padding-right 0.3s ease'
      }}>
        {/* Toolbar */}
        <div style={{
          padding: '16px 20px',
          background: '#f8f9fa',
          borderBottom: '1px solid #dee2e6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Inventory Management</h1>
            <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
              Manage your inventory items with spreadsheet-like controls
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '14px',
                background: '#fff'
              }}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter || ''}
              onChange={(e) => setCategoryFilter(e.target.value ? parseInt(e.target.value) : undefined)}
              style={{
                padding: '8px 12px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '14px',
                background: '#fff'
              }}
            >
              <option value="">All Categories</option>
              {lookups?.categories.map(category => (
                <option key={category.category_id} value={category.category_id}>
                  {category.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => navigate('/receiving')}
              style={{
                padding: '8px 16px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Receiving
            </button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <InventoryGrid 
            status={statusFilter || undefined}
            categoryId={categoryFilter}
            onRowClick={setSelectedItemId}
          />
        </div>
      </div>

      {/* Side Panel */}
      {selectedItemId && (
        <InventoryRowDetail
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
          onItemUpdated={handleItemUpdated}
        />
      )}

      {/* Quick Action to open item detail */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: selectedItemId ? '420px' : '20px',
        transition: 'right 0.3s ease'
      }}>
        <div style={{
          fontSize: '12px',
          color: '#6c757d',
          background: '#fff',
          padding: '8px 12px',
          borderRadius: '4px',
          border: '1px solid #dee2e6',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          💡 Click any row to view details
        </div>
      </div>
    </div>
  );
};

export default InventoryList;
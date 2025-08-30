import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../services/api';
import { InventoryItem, InventoryListResponse, AttributeProfile } from '../types/api';

interface InventoryGridProps {
  poId?: number;
  status?: string;
  categoryId?: number;
  onRowClick?: (itemId: number) => void;
}

const InventoryGrid: React.FC<InventoryGridProps> = ({ poId, status, categoryId, onRowClick }) => {
  const [inventoryData, setInventoryData] = useState<InventoryListResponse | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedRow, setFocusedRow] = useState<number>(0);
  const [focusedCol, setFocusedCol] = useState<string>('list_price');
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [filter, setFilter] = useState('');
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [profiles, setProfiles] = useState<Record<string, AttributeProfile>>({});
  const [allColumns, setAllColumns] = useState<Array<{key: string, label: string, type: 'static' | 'attribute', dataType?: string, width?: string, isRequired?: boolean}>>([]);
  const [gridTemplate, setGridTemplate] = useState<string>('');
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set(['product_title']));
  const [showColumnManager, setShowColumnManager] = useState(false);

  // Static columns that are always present
  const staticColumns: Array<{key: string, label: string, type: 'static', width: string}> = [
    { key: 'details', label: 'Details', type: 'static', width: '80px' },
    { key: 'product_title', label: 'Product', type: 'static', width: '2fr' },
    { key: 'status', label: 'Status', type: 'static', width: '120px' },
    { key: 'quantity', label: 'Qty', type: 'static', width: '80px' },
    { key: 'available', label: 'Available', type: 'static', width: '80px' },
    { key: 'list_price', label: 'List Price', type: 'static', width: '100px' },
    { key: 'seller_sku', label: 'SKU', type: 'static', width: '120px' },
    { key: 'condition_grade_id', label: 'Condition', type: 'static', width: '120px' },
    { key: 'title_suffix', label: 'Title Suffix', type: 'static', width: '120px' },
    { key: 'location', label: 'Location', type: 'static', width: '120px' },
  ];

  // Build dynamic columns from profiles
  const buildColumns = () => {
    if (inventoryItems.length === 0 || Object.keys(profiles).length === 0) {
      const defaultColumns = [...staticColumns, { key: 'updated_at', label: 'Updated', type: 'static' as const, width: '120px' }];
      setAllColumns(defaultColumns);
      const visibleColumns = defaultColumns.filter(col => !hiddenColumns.has(col.key));
      setGridTemplate(visibleColumns.map(col => col.width).join(' '));
      return;
    }

    // Find the most common profile
    const profileCounts: Record<string, number> = {};
    inventoryItems.forEach(item => {
      if (item.profile_id) {
        const profileKey = item.profile_id.toString();
        profileCounts[profileKey] = (profileCounts[profileKey] || 0) + 1;
      }
    });

    const mostCommonProfileId = Object.entries(profileCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];

    if (!mostCommonProfileId || !profiles[mostCommonProfileId]) {
      // No profiles found, use static columns only
      const defaultColumns = [...staticColumns, { key: 'updated_at', label: 'Updated', type: 'static' as const, width: '120px' }];
      setAllColumns(defaultColumns);
      const visibleColumns = defaultColumns.filter(col => !hiddenColumns.has(col.key));
      setGridTemplate(visibleColumns.map(col => col.width).join(' '));
      return;
    }

    const profile = profiles[mostCommonProfileId];
    const attributeColumns = profile.fields
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      .map(field => ({
        key: field.key_name,
        label: (field.display_label || field.key_name.replace(/_/g, ' ')) + ' ✨', // Add indicator for attribute columns
        type: 'attribute' as const,
        dataType: field.data_type,
        width: field.data_type === 'bool' ? '80px' : '120px',
        isRequired: field.is_required
      }));

    const newColumns = [
      ...staticColumns,
      ...attributeColumns,
      { key: 'updated_at', label: 'Updated', type: 'static' as const, width: '120px' }
    ];

    setAllColumns(newColumns);
    
    // Filter out hidden columns for grid template
    const visibleColumns = newColumns.filter(col => !hiddenColumns.has(col.key));
    setGridTemplate(visibleColumns.map(col => col.width).join(' '));
  };

  // Rebuild columns when items, profiles, or hidden columns change
  useEffect(() => {
    buildColumns();
  }, [inventoryItems, profiles, hiddenColumns]);

  // Get visible columns (not hidden)
  const visibleColumns = allColumns.filter(col => !hiddenColumns.has(col.key));
  
  // Split columns into frozen and scrollable
  const frozenCols = visibleColumns.filter(col => frozenColumns.has(col.key));
  const scrollableCols = visibleColumns.filter(col => !frozenColumns.has(col.key));

  const editableColumns = allColumns.filter(col => 
    col.key === 'list_price' || col.key === 'seller_sku' || col.key === 'condition_grade_id' || 
    col.key === 'title_suffix' || col.key === 'location' || col.type === 'attribute'
  ).map(col => col.key);
  
  // All columns for navigation (including non-editable, but only visible ones)
  const navigableColumns = visibleColumns.map(col => col.key);

  useEffect(() => {
    const loadInventoryData = async () => {
      try {
        setLoading(true);
        const response = await apiService.getInventoryItems({
          po_id: poId,
          status,
          category_id: categoryId,
          include_profiles: true,
          sort: '-updated_at',
          page_size: 100
        });
        setInventoryData(response);
        
        // Parse unit_attributes_json from string to object if needed
        const parsedItems = response.items.map(item => ({
          ...item,
          unit_attributes_json: (() => {
            if (typeof item.unit_attributes_json === 'string') {
              try {
                return JSON.parse(item.unit_attributes_json);
              } catch (e) {
                console.warn('Failed to parse unit_attributes_json for item', item.inventory_item_id, e);
                return {};
              }
            }
            return item.unit_attributes_json || {};
          })()
        }));
        
        setInventoryItems(parsedItems);
        if (response.profiles) {
          setProfiles(response.profiles);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load inventory data');
      } finally {
        setLoading(false);
      }
    };

    loadInventoryData();
  }, [poId, status, categoryId]);

  // Focus management for keyboard navigation
  useEffect(() => {
    if (inventoryItems.length > 0) {
      const cellKey = `${focusedRow}-${focusedCol}`;
      const inputRef = inputRefs.current[cellKey];
      if (inputRef && editingCell?.row === focusedRow && editingCell?.col === focusedCol) {
        inputRef.focus();
        inputRef.select();
      }
    }
  }, [focusedRow, focusedCol, editingCell]);

  // Auto-scroll to focused cell when focus changes
  useEffect(() => {
    if (inventoryItems.length > 0 && allColumns.length > 0) {
      const cellKey = `${focusedRow}-${focusedCol}`;
      const cellElement = cellRefs.current[cellKey];
      
      if (cellElement && gridContainerRef.current) {
        // Use scrollIntoView to ensure the focused cell is visible
        cellElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest', // Don't scroll vertically unless necessary
          inline: 'nearest' // Don't scroll horizontally unless necessary
        });
      }
    }
  }, [focusedRow, focusedCol, inventoryItems.length, allColumns.length]);

  const updateItem = async (index: number, field: string, value: any) => {
    const item = inventoryItems[index];
    if (!item) return;

    try {
      // Check if this is an attribute field
      const column = allColumns.find(col => col.key === field);
      const isAttributeField = column?.type === 'attribute';

      if (isAttributeField) {
        // Update attribute field via attributes API
        const currentAttributes = (typeof item.unit_attributes_json === 'object' && item.unit_attributes_json !== null) 
          ? item.unit_attributes_json as Record<string, any>
          : {};
        const newAttributes = { ...currentAttributes, [field]: value };
        
        await apiService.updateInventoryItemAttributes(item.inventory_item_id, {
          unit_attributes_json: newAttributes
        });
        
        // Update local state
        setInventoryItems(prev => prev.map((item, i) => 
          i === index ? { ...item, unit_attributes_json: newAttributes } : item
        ));
      } else {
        // Update static field via regular update API
        const updateData = { [field]: value };
        const updatedItem = await apiService.updateInventoryItem(item.inventory_item_id, updateData);
        
        setInventoryItems(prev => prev.map((item, i) => 
          i === index ? { ...item, ...updatedItem } : item
        ));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  const handleCellEdit = (row: number, col: string, value: string) => {
    let parsedValue: any = value;
    
    // Find the column definition
    const column = allColumns.find(c => c.key === col);
    
    if (column?.type === 'attribute') {
      // Handle attribute field parsing
      switch (column.dataType) {
        case 'bool':
          parsedValue = value === 'true' || value === '1';
          break;
        case 'int':
          parsedValue = value === '' ? null : parseInt(value) || null;
          break;
        case 'decimal':
          parsedValue = value === '' ? null : parseFloat(value) || null;
          break;
        case 'text':
        case 'string':
        default:
          parsedValue = value.trim() || null;
          break;
      }
    } else {
      // Handle static field parsing
      if (col === 'list_price') {
        parsedValue = value === '' ? null : parseFloat(value) || null;
      } else if (col === 'condition_grade_id') {
        parsedValue = value === '' ? null : parseInt(value) || null;
      } else {
        parsedValue = value.trim() || null;
      }
    }

    updateItem(row, col, parsedValue);
    setEditingCell(null);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (inventoryItems.length === 0) return;

    const activeElement = document.activeElement;
    const isInputFocused = activeElement?.tagName === 'INPUT';

    // If editing a cell, handle edit-specific keys
    if (editingCell && isInputFocused) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const inputRef = inputRefs.current[`${editingCell.row}-${editingCell.col}`];
        if (inputRef) {
          handleCellEdit(editingCell.row, editingCell.col, inputRef.value);
        }
        
        // Move to next editable cell
        if (e.key === 'Tab' && !e.shiftKey) {
          const currentColIndex = editableColumns.indexOf(editingCell.col);
          const nextColIndex = (currentColIndex + 1) % editableColumns.length;
          const nextRow = nextColIndex === 0 ? Math.min(editingCell.row + 1, inventoryItems.length - 1) : editingCell.row;
          
          setFocusedRow(nextRow);
          setFocusedCol(editableColumns[nextColIndex]);
          setTimeout(() => setEditingCell({ row: nextRow, col: editableColumns[nextColIndex] }), 0);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditingCell(null);
      }
      return;
    }

    // Navigation shortcuts
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedRow(prev => Math.min(prev + 1, inventoryItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedRow(prev => Math.max(prev - 1, 0));
        break;
      case 'ArrowRight':
        e.preventDefault();
        const currentColIndex = navigableColumns.indexOf(focusedCol);
        const nextColIndex = Math.min(currentColIndex + 1, navigableColumns.length - 1);
        setFocusedCol(navigableColumns[nextColIndex]);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        const currentColIndexLeft = navigableColumns.indexOf(focusedCol);
        const prevColIndex = Math.max(currentColIndexLeft - 1, 0);
        setFocusedCol(navigableColumns[prevColIndex]);
        break;
      case 'Enter':
      case 'F2':
        if (!isInputFocused && editableColumns.includes(focusedCol)) {
          e.preventDefault();
          setEditingCell({ row: focusedRow, col: focusedCol });
        }
        break;
      case 'Tab':
        e.preventDefault();
        const tabColIndex = editableColumns.indexOf(focusedCol);
        if (e.shiftKey) {
          // Shift+Tab - go backwards
          if (tabColIndex === 0) {
            setFocusedRow(prev => Math.max(prev - 1, 0));
            setFocusedCol(editableColumns[editableColumns.length - 1]);
          } else {
            setFocusedCol(editableColumns[tabColIndex - 1]);
          }
        } else {
          // Tab - go forwards
          if (tabColIndex === editableColumns.length - 1) {
            setFocusedRow(prev => Math.min(prev + 1, inventoryItems.length - 1));
            setFocusedCol(editableColumns[0]);
          } else {
            setFocusedCol(editableColumns[tabColIndex + 1]);
          }
        }
        break;
    }
  }, [inventoryItems, focusedRow, focusedCol, editingCell]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const filteredItems = inventoryItems.filter(item => {
    if (!filter) return true;
    return item.product_title.toLowerCase().includes(filter.toLowerCase()) ||
           item.seller_sku?.toLowerCase().includes(filter.toLowerCase()) ||
           item.po_number.toLowerCase().includes(filter.toLowerCase());
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      'Active': { background: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' },
      'Pending': { background: '#fff3cd', color: '#856404', border: '1px solid #ffeaa7' },
      'Damaged': { background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb' },
      'Archived': { background: '#e2e3e5', color: '#383d41', border: '1px solid #ced4da' }
    };
    
    return (
      <span style={{
        ...styles[status as keyof typeof styles] || styles.Pending,
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold'
      }}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '50vh'
      }}>
        Loading inventory...
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
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!inventoryData) return null;

  return (
    <div style={{ padding: '16px', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
            Inventory {poId ? `(PO: ${inventoryData.items[0]?.po_number || poId})` : ''}
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
            Total: {inventoryData.total} items | Showing: {filteredItems.length} | 
            {allColumns.filter(c => c.type === 'attribute').length > 0 && 
              ` Dynamic fields: ${allColumns.filter(c => c.type === 'attribute').length}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search items..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '14px',
              width: '200px'
            }}
          />
          <button
            onClick={() => setShowColumnManager(!showColumnManager)}
            style={{
              padding: '8px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              background: '#fff',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Columns
          </button>
          <div style={{ fontSize: '12px', color: '#6c757d', background: '#fff', padding: '6px 12px', borderRadius: '4px', border: '1px solid #dee2e6' }}>
            Arrows=Navigate | Enter/F2=Edit | Tab=Next Cell | Esc=Cancel
          </div>
        </div>
      </div>
      
      {/* Column Manager */}
      {showColumnManager && (
        <div style={{
          background: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '16px',
          fontSize: '14px'
        }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Column Visibility</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {allColumns.map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={!hiddenColumns.has(col.key)}
                      disabled={col.key === 'product_title'} // Don't allow hiding main product column
                      onChange={(e) => {
                        const newHidden = new Set(hiddenColumns);
                        if (e.target.checked) {
                          newHidden.delete(col.key);
                        } else {
                          newHidden.add(col.key);
                        }
                        setHiddenColumns(newHidden);
                      }}
                    />
                    <span style={{ color: col.type === 'attribute' ? '#007bff' : 'inherit' }}>
                      {col.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Frozen Columns</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {visibleColumns.map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={frozenColumns.has(col.key)}
                      onChange={(e) => {
                        const newFrozen = new Set(frozenColumns);
                        if (e.target.checked) {
                          newFrozen.add(col.key);
                        } else {
                          newFrozen.delete(col.key);
                        }
                        setFrozenColumns(newFrozen);
                      }}
                    />
                    <span style={{ color: col.type === 'attribute' ? '#007bff' : 'inherit' }}>
                      {col.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Grid */}
      <div 
        ref={gridContainerRef}
        style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: '8px', background: '#fff', overflow: 'auto' }}
      >
        <div style={{ minWidth: 'max-content' }}>
          {/* Sticky Header */}
          <div style={{ 
            position: 'sticky',
            top: 0,
            zIndex: 10,
            padding: '12px 16px', 
            background: '#f8f9fa', 
            borderBottom: '1px solid #dee2e6', 
            fontWeight: 'bold', 
            fontSize: '14px', 
            color: '#495057', 
            display: 'grid', 
            gridTemplateColumns: gridTemplate, 
            gap: '12px', 
            alignItems: 'center' 
          }}>
            {visibleColumns.map(column => (
              <div key={column.key} style={{ 
                color: column.type === 'attribute' ? '#007bff' : '#495057',
                fontSize: column.type === 'attribute' ? '13px' : '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {column.label}
                {frozenColumns.has(column.key) && <span style={{ color: '#28a745', fontSize: '12px' }}>\ud83d\udccc</span>}
              </div>
            ))}
          </div>
          
          {/* Data Rows */}
          <div>
            {filteredItems.map((item, index) => {
            const actualIndex = inventoryItems.indexOf(item);
            const isFocused = focusedRow === actualIndex;
            
            return (
              <div 
                key={item.inventory_item_id}
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: gridTemplate, 
                  gap: '12px', 
                  padding: '8px 16px', 
                  borderBottom: '1px solid #f1f3f4', 
                  backgroundColor: isFocused ? '#e3f2fd' : 'transparent', 
                  alignItems: 'center', 
                  fontSize: '14px'
                }}
              >
                {visibleColumns.map((column) => {
                  const isEditable = editableColumns.includes(column.key);
                  const cellKey = `${actualIndex}-${column.key}`;
                  const isEditing = editingCell?.row === actualIndex && editingCell?.col === column.key;
                  const isCellFocused = isFocused && focusedCol === column.key;
                  
                  // Get cell value
                  const getCellValue = () => {
                    if (column.key === 'details') {
                      return 'details-button'; // Special marker for details button
                    } else if (column.type === 'attribute') {
                      // Check if this item has the same profile as the column
                      const hasMatchingProfile = item.profile_id && profiles[item.profile_id.toString()]?.fields?.some(f => f.key_name === column.key);
                      if (!hasMatchingProfile) {
                        return undefined; // Item doesn't have this attribute
                      }
                      const attributes = (typeof item.unit_attributes_json === 'object' && item.unit_attributes_json !== null) 
                        ? item.unit_attributes_json as Record<string, any>
                        : {};
                      return attributes[column.key];
                    } else {
                      return item[column.key as keyof InventoryItem];
                    }
                  };
                  
                  const cellValue = getCellValue();
                  const isAttributeApplicable = column.type !== 'attribute' || (item.profile_id && profiles[item.profile_id.toString()]?.fields?.some(f => f.key_name === column.key));
                  
                  // Format display value
                  const getDisplayValue = () => {
                    // Handle details button
                    if (column.key === 'details') {
                      return (
                        <button
                          onClick={() => onRowClick?.(item.inventory_item_id)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            border: '1px solid #007bff',
                            borderRadius: '4px',
                            background: '#fff',
                            color: '#007bff',
                            cursor: 'pointer'
                          }}
                        >
                          View
                        </button>
                      );
                    }
                    
                    // If this is an attribute that doesn't apply to this item, show N/A
                    if (column.type === 'attribute' && !isAttributeApplicable) {
                      return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>N/A</span>;
                    }
                    
                    if (column.key === 'product_title') {
                      return (
                        <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.product_title}
                          {item.product_brand && <div style={{ fontSize: '12px', color: '#6c757d' }}>{item.product_brand}</div>}
                        </div>
                      );
                    } else if (column.key === 'status') {
                      return getStatusBadge(item.status);
                    } else if (column.key === 'quantity' || column.key === 'available') {
                      return <div style={{ textAlign: 'center' }}>{cellValue}</div>;
                    } else if (column.key === 'updated_at') {
                      return <div style={{ fontSize: '12px', color: '#6c757d' }}>{new Date(item.updated_at).toLocaleDateString()}</div>;
                    } else if (column.key === 'list_price' && cellValue) {
                      return `$${parseFloat(cellValue.toString()).toFixed(2)}`;
                    } else if (column.type === 'attribute' && column.dataType === 'bool') {
                      return cellValue ? '✓' : '✗';
                    } else {
                      return cellValue?.toString() || '—';
                    }
                  };
                  
                  // Render non-editable cells (including non-applicable attributes)
                  if (!isEditable || (column.type === 'attribute' && !isAttributeApplicable)) {
                    return (
                      <div 
                        key={cellKey} 
                        ref={el => cellRefs.current[cellKey] = el}
                        style={{
                          padding: '4px 8px',
                          minHeight: '24px',
                          border: isCellFocused ? '2px solid #007bff' : '1px solid transparent',
                          borderRadius: '4px',
                          background: isCellFocused ? '#f8f9fa' : 'transparent'
                        }}
                      >
                        {getDisplayValue()}
                      </div>
                    );
                  }
                  
                  // Render editable cells
                  return (
                    <div key={cellKey} ref={el => cellRefs.current[cellKey] = el} style={{ position: 'relative' }}>
                      {isEditing ? (
                        // Editing mode
                        column.type === 'attribute' && column.dataType === 'bool' ? (
                          <input
                            ref={el => inputRefs.current[cellKey] = el}
                            type="checkbox"
                            defaultChecked={!!cellValue}
                            style={{ transform: 'scale(1.2)' }}
                            onBlur={(e) => handleCellEdit(actualIndex, column.key, e.target.checked ? 'true' : 'false')}
                            onKeyDown={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        ) : (
                          <input
                            ref={el => inputRefs.current[cellKey] = el}
                            type={
                              column.key === 'list_price' || column.dataType === 'decimal' ? 'number' : 
                              column.key === 'condition_grade_id' || column.dataType === 'int' ? 'number' : 
                              'text'
                            }
                            step={column.key === 'list_price' || column.dataType === 'decimal' ? '0.01' : undefined}
                            defaultValue={cellValue?.toString() || ''}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              border: '2px solid #007bff',
                              borderRadius: '4px',
                              fontSize: '14px',
                              background: '#fff'
                            }}
                            onBlur={(e) => handleCellEdit(actualIndex, column.key, e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        )
                      ) : (
                        // Display mode
                        <div
                          style={{
                            padding: '4px 8px',
                            minHeight: '24px',
                            border: isCellFocused ? '2px solid #007bff' : '1px solid transparent',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: isCellFocused ? '#f8f9fa' : 'transparent',
                            color: column.type === 'attribute' ? '#007bff' : 'inherit'
                          }}
                          onClick={() => {
                            setFocusedRow(actualIndex);
                            setFocusedCol(column.key);
                            setEditingCell({ row: actualIndex, col: column.key });
                          }}
                        >
                          {getDisplayValue()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryGrid;
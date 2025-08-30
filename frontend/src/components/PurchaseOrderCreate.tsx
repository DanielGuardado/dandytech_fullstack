import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { catalogService } from '../services/catalogService';
import { 
  POCreate, 
  POResponse, 
  Source, 
  PaymentMethod, 
  Category, 
  Platform,
  VariantType,
  POLineItem,
  POLineItemCreate
} from '../types/api';
import AddLineItemFlow from './AddLineItemFlow';
import POSelector from './POSelector';

interface LineItemWithDetails extends POLineItem {
  product_title?: string;
  variant_type_code?: string;
  current_market_value?: number;
}

const PurchaseOrderCreate: React.FC = () => {
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

  // Lookup data
  const [sources, setSources] = useState<Source[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([]);

  // PO and line items
  const [poId, setPoId] = useState<number | null>(null);
  const [lineItems, setLineItems] = useState<LineItemWithDetails[]>([]);
  const [showAddItemFlow, setShowAddItemFlow] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<POResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // New state for PO switching and editing
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [originalFormData, setOriginalFormData] = useState<POCreate | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Line item editing state
  const [editingLineItemId, setEditingLineItemId] = useState<number | null>(null);
  const [editingLineItemData, setEditingLineItemData] = useState<any>(null);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const lookups = await apiService.getLookups();
        setSources(lookups.sources);
        setPaymentMethods(lookups.payment_methods);
        setCategories(lookups.categories);
        setPlatforms(lookups.platforms);
        setVariantTypes(lookups.variant_types);
        
        if (lookups.sources.length > 0) {
          setFormData(prev => ({ ...prev, source_id: lookups.sources[0].source_id }));
        }
      } catch (err) {
        setError(`Failed to load form data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    loadLookups();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const newFormData = {
      ...formData,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    };
    
    setFormData(newFormData);
    
    // Check if we have unsaved changes when editing an existing PO
    if (poId && originalFormData) {
      const hasChanges = JSON.stringify(newFormData) !== JSON.stringify(originalFormData);
      setHasUnsavedChanges(hasChanges);
    }
  };

  // Handle PO selection from dropdown
  const handlePoSelect = async (selectedPo: any | null) => {
    if (selectedPo) {
      // Load existing PO
      try {
        const poDetail = await apiService.getPurchaseOrder(selectedPo.purchase_order_id);
        
        // Update form data with PO details
        const poFormData: POCreate = {
          source_id: poDetail.source_id,
          date_purchased: poDetail.date_purchased || new Date().toISOString().split('T')[0],
          payment_method_id: poDetail.payment_method_id || undefined,
          external_order_number: poDetail.external_order_number || '',
          subtotal: poDetail.subtotal,
          tax: poDetail.tax,
          shipping: poDetail.shipping,
          fees: poDetail.fees,
          discounts: poDetail.discounts,
          notes: poDetail.notes || '',
        };
        
        setFormData(poFormData);
        setOriginalFormData(poFormData);
        setPoId(poDetail.purchase_order_id);
        setSuccess({
          purchase_order_id: poDetail.purchase_order_id,
          po_number: poDetail.po_number,
          status: poDetail.status,
          is_locked: poDetail.is_locked,
          total_cost: poDetail.total_cost,
          lines: []
        });
        
        // Load line items with details - they should now include the product info from the backend
        const enrichedLineItems = poDetail.lines.map(line => ({
          ...line,
          product_title: line.product_title || 'Unknown Product',
          variant_type_code: line.variant_type_code || 'Unknown Variant',
          current_market_value: 0 // This field is not provided by the backend for existing POs
        }));
        setLineItems(enrichedLineItems);
        
        setHasUnsavedChanges(false);
        setIsEditingHeader(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load PO');
      }
    } else {
      // Create new PO - reset form
      const newFormData: POCreate = {
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
      };
      
      setFormData(newFormData);
      setOriginalFormData(null);
      setPoId(null);
      setSuccess(null);
      setLineItems([]);
      setHasUnsavedChanges(false);
      setIsEditingHeader(false);
    }
  };

  // Handle saving header changes
  const handleSaveHeaderChanges = async () => {
    if (!poId || !hasUnsavedChanges) return;

    setLoading(true);
    setError(null);

    try {
      const updateData = {
        date_purchased: formData.date_purchased,
        payment_method_id: formData.payment_method_id,
        external_order_number: formData.external_order_number,
        subtotal: formData.subtotal,
        tax: formData.tax,
        shipping: formData.shipping,
        fees: formData.fees,
        discounts: formData.discounts,
        notes: formData.notes,
      };

      const updatedPO = await apiService.updatePurchaseOrder(poId, updateData);
      
      // Update success state with new total
      setSuccess(prev => prev ? { ...prev, total_cost: updatedPO.total_cost } : null);
      
      // Update original form data to match current state
      setOriginalFormData({ ...formData });
      setHasUnsavedChanges(false);
      setIsEditingHeader(false);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePO = async () => {
    if (poId) return; // Already created

    setLoading(true);
    setError(null);

    try {
      const result = await apiService.createPurchaseOrder(formData);
      setPoId(result.purchase_order_id);
      setSuccess(result);
      setOriginalFormData({ ...formData }); // Store original data for comparison
      setHasUnsavedChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  interface AllocationDetails {
    allocation_basis: number;
    cost_assignment_method: 'manual' | 'by_market_value';
    allocation_basis_source: string;
  }

  const handleAddLineItem = async (lineItemData: POLineItemCreate & { product_title: string; variant_type_code: string; current_market_value?: number }, allocationDetails: AllocationDetails) => {
    if (!poId) {
      setError('Must create PO first');
      return;
    }

    try {
      const newItem = await catalogService.addLineItem(poId, {
        variant_id: lineItemData.variant_id,
        catalog_product_id: lineItemData.catalog_product_id,
        quantity_expected: lineItemData.quantity_expected,
        allocation_basis: allocationDetails.allocation_basis,
        allocation_basis_source: allocationDetails.allocation_basis_source,
        cost_assignment_method: allocationDetails.cost_assignment_method,
        // For manual method, set allocated_unit_cost for immediate display
        allocated_unit_cost: allocationDetails.cost_assignment_method === 'manual' ? allocationDetails.allocation_basis : undefined,
      });

      // Add the display details
      const itemWithDetails: LineItemWithDetails = {
        ...newItem,
        product_title: lineItemData.product_title,
        variant_type_code: lineItemData.variant_type_code,
        current_market_value: lineItemData.current_market_value,
      };

      setLineItems(prev => [...prev, itemWithDetails]);
      setShowAddItemFlow(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add line item');
    }
  };

  const handleRemoveLineItem = async (itemId: number) => {
    if (!poId) return;

    setLoading(true);
    setError(null);

    try {
      await apiService.deletePurchaseOrderLineItem(poId, itemId);
      
      // Remove from local state after successful API call
      setLineItems(prev => prev.filter(item => item.purchase_order_item_id !== itemId));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete line item');
    } finally {
      setLoading(false);
    }
  };

  // Handle starting line item edit
  const handleStartEditLineItem = (item: LineItemWithDetails) => {
    setEditingLineItemId(item.purchase_order_item_id);
    setEditingLineItemData({
      quantity_expected: item.quantity_expected,
      allocation_basis: item.allocation_basis,
      allocation_basis_source: item.allocation_basis_source,
      cost_assignment_method: item.cost_assignment_method,
      allocated_unit_cost: item.allocated_unit_cost,
      notes: item.notes || ''
    });
  };

  // Handle line item edit input change
  const handleLineItemEditChange = (field: string, value: any) => {
    setEditingLineItemData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle saving line item changes
  const handleSaveLineItemChanges = async () => {
    if (!editingLineItemId || !poId) return;

    setLoading(true);
    setError(null);

    try {
      const updatedItem = await apiService.updatePurchaseOrderLineItem(
        poId,
        editingLineItemId,
        editingLineItemData
      );

      // Update the line item in the local state while preserving display fields
      setLineItems(prev => prev.map(item =>
        item.purchase_order_item_id === editingLineItemId
          ? { 
              ...item, 
              ...updatedItem,
              // Preserve display fields that aren't returned by the API
              product_title: item.product_title,
              variant_type_code: item.variant_type_code,
              current_market_value: item.current_market_value
            }
          : item
      ));

      setEditingLineItemId(null);
      setEditingLineItemData(null);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update line item');
    } finally {
      setLoading(false);
    }
  };

  // Handle canceling line item edit
  const handleCancelLineItemEdit = () => {
    setEditingLineItemId(null);
    setEditingLineItemData(null);
  };

  const handleLockPO = async () => {
    if (!poId) return;

    setLoading(true);
    try {
      await catalogService.lockPurchaseOrder(poId);
      
      // Refresh the PO data to get the final allocated costs
      const updatedPO = await apiService.getPurchaseOrder(poId);
      setSuccess(prev => prev ? { ...prev, is_locked: true, total_cost: updatedPO.total_cost } : null);
      
      // Update line items with the final allocated costs
      const updatedLineItems = updatedPO.lines.map(line => {
        const existingItem = lineItems.find(item => item.purchase_order_item_id === line.purchase_order_item_id);
        return {
          ...line,
          product_title: existingItem?.product_title,
          variant_type_code: existingItem?.variant_type_code,
          current_market_value: existingItem?.current_market_value,
        };
      });
      setLineItems(updatedLineItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock PO');
    } finally {
      setLoading(false);
    }
  };

  const totalCost = formData.subtotal + formData.tax + formData.shipping + formData.fees - formData.discounts;

  // Move calculateSimulatedUnitCost function here to fix hoisting issue
  const calculateSimulatedUnitCost = (item: LineItemWithDetails): number | null => {
    if (success?.is_locked) {
      // For locked POs, return the actual allocated unit cost
      return item.allocated_unit_cost || null;
    }
    
    if (item.cost_assignment_method === 'manual') {
      // For manual items, return the already-set allocated unit cost
      return item.allocated_unit_cost || null;
    }
    
    if (item.cost_assignment_method === 'by_market_value') {
      // Calculate simulated cost using the same formula as the backend stored procedure
      
      // Step 1: Calculate manual items total
      const manualTotal = lineItems
        .filter(li => li.cost_assignment_method === 'manual')
        .reduce((sum, li) => sum + (li.allocated_unit_cost || 0) * li.quantity_expected, 0);
      
      // Step 2: Calculate pool (total cost minus manual allocation)
      const pool = totalCost - manualTotal;
      
      if (pool <= 0) return 0;
      
      // Step 3: Calculate total weight of market value items
      const marketValueItems = lineItems.filter(li => li.cost_assignment_method === 'by_market_value');
      const totalWeight = marketValueItems.reduce((sum, li) => 
        sum + (li.allocation_basis || 0) * li.quantity_expected, 0
      );
      
      if (totalWeight === 0) return 0;
      
      // Step 4: Calculate this item's weight
      const itemWeight = (item.allocation_basis || 0) * item.quantity_expected;
      
      // Step 5: Calculate allocated total for this item
      const allocatedTotal = (pool * itemWeight) / totalWeight;
      
      // Step 6: Calculate unit cost
      if (item.quantity_expected === 0) return 0;
      
      return Math.round((allocatedTotal / item.quantity_expected) * 100) / 100; // Round to 2 decimals
    }
    
    return null;
  };

  const lineItemsTotal = lineItems.reduce((sum, item) => {
    let unitPrice = 0;
    if (success?.is_locked) {
      // For locked POs, use the final allocated unit cost
      unitPrice = item.allocated_unit_cost || 0;
    } else if (item.cost_assignment_method === 'manual') {
      // For manual items, use the allocated unit cost directly
      unitPrice = item.allocated_unit_cost || 0;
    } else {
      // For market value items, calculate simulated unit cost
      const simulatedCost = calculateSimulatedUnitCost(item);
      unitPrice = simulatedCost || 0;
    }
    return sum + unitPrice * item.quantity_expected;
  }, 0);

  const calculateItemPercentage = (item: LineItemWithDetails): number | null => {
    if (success?.is_locked) {
      // For locked POs, calculate percentage based on final allocated costs
      if (lineItemsTotal === 0) return null;
      const itemTotal = (item.allocated_unit_cost || 0) * item.quantity_expected;
      return Math.round((itemTotal / lineItemsTotal) * 100);
    } else {
      // For unlocked POs, only calculate for market value items
      if (item.cost_assignment_method !== 'by_market_value') return null;
      
      const marketValueItems = lineItems.filter(li => li.cost_assignment_method === 'by_market_value');
      const marketValueTotal = marketValueItems.reduce((sum, li) => 
        sum + (li.allocation_basis || 0) * li.quantity_expected, 0
      );
      
      if (marketValueTotal === 0) return null;
      
      const itemMarketValue = (item.allocation_basis || 0) * item.quantity_expected;
      return Math.round((itemMarketValue / marketValueTotal) * 100);
    }
  };

  return (
    <div style={{ 
      height: 'calc(100vh - 20px)', 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      padding: '4px'
    }}>
      
      {/* PO Selector Bar - Compact Header */}
      <div style={{ 
        display: 'flex', 
        gap: '12px',
        alignItems: 'center',
        flexShrink: 0,
        height: '48px'
      }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <POSelector 
            currentPoId={poId}
            onPoSelect={handlePoSelect}
            sources={sources}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasUnsavedChanges && (
            <span style={{ 
              fontSize: '10px', 
              color: '#ffc107', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ⚠️ Unsaved Changes
            </span>
          )}
        </div>
      </div>

      {/* Progress/Status Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: '#f8f9fa',
        padding: '4px 12px',
        borderRadius: '4px',
        border: '1px solid #e9ecef',
        flexShrink: 0,
        height: '28px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>
            {poId ? 'Edit PO' : 'Create PO'}
          </span>
          
          {/* Mini Progress Steps */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '2px',
              padding: '1px 6px',
              background: !poId ? '#007bff' : '#28a745',
              color: 'white',
              borderRadius: '8px',
              fontSize: '8px',
              fontWeight: 'bold'
            }}>
              <span>1</span>
              {poId && <span>✓</span>}
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '2px',
              padding: '1px 6px',
              background: poId && !success?.is_locked ? '#007bff' : poId && success?.is_locked ? '#28a745' : '#6c757d',
              color: 'white',
              borderRadius: '8px',
              fontSize: '8px',
              fontWeight: 'bold',
              opacity: poId ? 1 : 0.5
            }}>
              <span>2</span>
              {success?.is_locked && <span>✓</span>}
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '2px',
              padding: '1px 6px',
              background: success?.is_locked ? '#28a745' : '#6c757d',
              color: 'white',
              borderRadius: '8px',
              fontSize: '8px',
              fontWeight: 'bold',
              opacity: success?.is_locked ? 1 : 0.5
            }}>
              <span>3</span>
              {success?.is_locked && <span>✓</span>}
            </div>
          </div>
        </div>

        {/* Ultra Compact Status */}
        <div style={{ 
          fontSize: '10px', 
          color: '#6c757d',
          fontFamily: 'monospace'
        }}>
          {success?.is_locked 
            ? `${success.po_number} Locked $${success.total_cost.toFixed(2)}`
            : poId 
              ? `${success?.po_number} Adding Items`
              : 'New'
          }
        </div>
      </div>
      
      {/* Ultra Compact Messages */}
      {success && (
        <div style={{
          background: '#d4edda',
          color: '#155724',
          padding: '3px 8px',
          borderRadius: '3px',
          border: '1px solid #c3e6cb',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '10px',
          flexShrink: 0,
          height: '20px'
        }}>
          <span>✅</span>
          <span><strong>PO {success.is_locked ? 'Locked' : 'Created'}:</strong> {success.po_number}</span>
        </div>
      )}
      
      {error && (
        <div style={{
          background: '#f8d7da',
          color: '#721c24',
          padding: '3px 8px',
          borderRadius: '3px',
          border: '1px solid #f5c6cb',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '10px',
          flexShrink: 0,
          height: '20px'
        }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Cost Allocation Warnings */}
      {poId && lineItems.length > 0 && !success?.is_locked && (() => {
        const headerTotal = totalCost;
        // Calculate actual unit cost totals (not allocation basis)
        const lineItemsAllocatedTotal = lineItems.reduce((sum, item) => {
          let unitPrice = 0;
          if (item.cost_assignment_method === 'manual') {
            // For manual items, use the allocated unit cost directly
            unitPrice = item.allocated_unit_cost || 0;
          } else {
            // For market value items, calculate simulated unit cost
            const simulatedCost = calculateSimulatedUnitCost(item);
            unitPrice = simulatedCost || 0;
          }
          return sum + unitPrice * item.quantity_expected;
        }, 0);
        
        const difference = Math.abs(headerTotal - lineItemsAllocatedTotal);
        const percentageDiff = headerTotal > 0 ? (difference / headerTotal) * 100 : 0;
        
        if (difference > 0.01) {
          return (
            <div style={{
              background: percentageDiff > 10 ? '#f8d7da' : '#fff3cd',
              color: percentageDiff > 10 ? '#721c24' : '#856404',
              padding: '4px 8px',
              borderRadius: '3px',
              border: percentageDiff > 10 ? '1px solid #f5c6cb' : '1px solid #ffeaa7',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '10px',
              flexShrink: 0
            }}>
              <span>{percentageDiff > 10 ? '🚨' : '⚠️'}</span>
              <div>
                <strong>Cost Allocation Warning:</strong> Header total (${headerTotal.toFixed(2)}) differs from estimated line items total (${lineItemsAllocatedTotal.toFixed(2)}) by ${difference.toFixed(2)} ({percentageDiff.toFixed(1)}%)
                {percentageDiff > 10 && <span> - Large discrepancy detected!</span>}
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Main Content Area - 3 Column Layout */}
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        gap: '8px',
        minHeight: 0,
        overflow: 'hidden'
      }}>
        
        {/* Left Side - PO Header Form */}
        <div style={{ 
          width: showAddItemFlow ? '280px' : '320px',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          maxHeight: '100%'
        }}>
          <div style={{ 
            padding: '4px 8px',
            borderBottom: '1px solid #dee2e6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            minHeight: '32px'
          }}>
            <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold' }}>
              Order Details
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {poId && !success?.is_locked && (
                <>
                  {isEditingHeader || hasUnsavedChanges ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={handleSaveHeaderChanges}
                        disabled={loading || !hasUnsavedChanges}
                        style={{
                          background: hasUnsavedChanges ? '#28a745' : '#6c757d',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '2px',
                          fontSize: '8px',
                          fontWeight: 'bold',
                          border: 'none',
                          cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed'
                        }}
                      >
                        {loading ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          if (originalFormData) {
                            setFormData(originalFormData);
                            setHasUnsavedChanges(false);
                            setIsEditingHeader(false);
                          }
                        }}
                        disabled={loading}
                        style={{
                          background: '#6c757d',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '2px',
                          fontSize: '8px',
                          fontWeight: 'bold',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditingHeader(true)}
                      style={{
                        background: '#007bff',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '2px',
                        fontSize: '8px',
                        fontWeight: 'bold',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Edit
                    </button>
                  )}
                </>
              )}
              
              {poId && (
                <div style={{
                  background: success?.is_locked ? '#dc3545' : '#28a745',
                  color: 'white',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  fontSize: '8px',
                  fontWeight: 'bold'
                }}>
                  {success?.is_locked ? 'LOCKED' : 'CREATED'}
                </div>
              )}
            </div>
          </div>
          
          <div style={{ 
            padding: '8px', 
            flex: 1, 
            overflow: 'auto',
            maxHeight: 'calc(100vh - 160px)' // Ensure scrollable area
          }}>
            <form onSubmit={(e) => { e.preventDefault(); handleCreatePO(); }} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              
              {/* Source and Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#6c757d', marginBottom: '3px', textTransform: 'uppercase' }}>
                    Source *
                  </label>
                  <select
                    id="source_id"
                    name="source_id"
                    value={formData.source_id}
                    onChange={handleInputChange}
                    required
                    disabled={!!poId} // Source cannot be changed after creation
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #dee2e6',
                      borderRadius: '3px',
                      fontSize: '12px',
                      background: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#f8f9fa' : 'white',
                      color: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#6c757d' : '#212529'
                    }}
                  >
                    {sources.map(source => (
                      <option key={source.source_id} value={source.source_id}>
                        {source.name} ({source.code})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#6c757d', marginBottom: '3px', textTransform: 'uppercase' }}>
                    Date Purchased
                  </label>
                  <input
                    type="date"
                    id="date_purchased"
                    name="date_purchased"
                    value={formData.date_purchased}
                    onChange={handleInputChange}
                    disabled={!!poId && !isEditingHeader && !hasUnsavedChanges}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #dee2e6',
                      borderRadius: '3px',
                      fontSize: '12px',
                      background: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#f8f9fa' : 'white',
                      color: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#6c757d' : '#212529'
                    }}
                  />
                </div>
              </div>

              {/* Payment Method and External Order */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#6c757d', marginBottom: '3px', textTransform: 'uppercase' }}>
                    Payment Method
                  </label>
                  <select
                    id="payment_method_id"
                    name="payment_method_id"
                    value={formData.payment_method_id || ''}
                    onChange={handleInputChange}
                    disabled={!!poId && !isEditingHeader && !hasUnsavedChanges}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #dee2e6',
                      borderRadius: '3px',
                      fontSize: '12px',
                      background: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#f8f9fa' : 'white',
                      color: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#6c757d' : '#212529'
                    }}
                  >
                    <option value="">Select</option>
                    {paymentMethods.map(method => (
                      <option key={method.payment_method_id} value={method.payment_method_id}>
                        {method.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#6c757d', marginBottom: '3px', textTransform: 'uppercase' }}>
                    External Order #
                  </label>
                  <input
                    type="text"
                    id="external_order_number"
                    name="external_order_number"
                    value={formData.external_order_number}
                    onChange={handleInputChange}
                    placeholder="eBay order #"
                    disabled={!!poId && !isEditingHeader && !hasUnsavedChanges}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #dee2e6',
                      borderRadius: '3px',
                      fontSize: '12px',
                      background: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#f8f9fa' : 'white',
                      color: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#6c757d' : '#212529'
                    }}
                  />
                </div>
              </div>

              {/* Financial Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#6c757d', marginBottom: '3px', textTransform: 'uppercase' }}>
                    Subtotal ($)
                  </label>
                  <input
                    type="number"
                    id="subtotal"
                    name="subtotal"
                    value={formData.subtotal}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    disabled={!!poId && !isEditingHeader && !hasUnsavedChanges}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #dee2e6',
                      borderRadius: '3px',
                      fontSize: '12px',
                      background: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#f8f9fa' : 'white',
                      color: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#6c757d' : '#212529',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#6c757d', marginBottom: '3px', textTransform: 'uppercase' }}>
                    Tax ($)
                  </label>
                  <input
                    type="number"
                    id="tax"
                    name="tax"
                    value={formData.tax}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    disabled={!!poId && !isEditingHeader && !hasUnsavedChanges}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #dee2e6',
                      borderRadius: '3px',
                      fontSize: '12px',
                      background: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#f8f9fa' : 'white',
                      color: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#6c757d' : '#212529',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#6c757d', marginBottom: '3px', textTransform: 'uppercase' }}>
                    Shipping ($)
                  </label>
                  <input
                    type="number"
                    id="shipping"
                    name="shipping"
                    value={formData.shipping}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    disabled={!!poId && !isEditingHeader && !hasUnsavedChanges}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #dee2e6',
                      borderRadius: '3px',
                      fontSize: '12px',
                      background: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#f8f9fa' : 'white',
                      color: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#6c757d' : '#212529',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#6c757d', marginBottom: '3px', textTransform: 'uppercase' }}>
                    Fees ($)
                  </label>
                  <input
                    type="number"
                    id="fees"
                    name="fees"
                    value={formData.fees}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    disabled={!!poId && !isEditingHeader && !hasUnsavedChanges}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #dee2e6',
                      borderRadius: '3px',
                      fontSize: '12px',
                      background: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#f8f9fa' : 'white',
                      color: (!!poId && !isEditingHeader && !hasUnsavedChanges) ? '#6c757d' : '#212529',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#6c757d', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Discounts ($)
                </label>
                <input
                  type="number"
                  id="discounts"
                  name="discounts"
                  value={formData.discounts}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  disabled={!!poId && !isEditingHeader && !hasUnsavedChanges}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '14px',
                    background: poId ? '#f8f9fa' : 'white',
                    color: poId ? '#6c757d' : '#212529',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#6c757d', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Additional notes about this purchase order..."
                  disabled={!!poId && !isEditingHeader && !hasUnsavedChanges}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '14px',
                    background: poId ? '#f8f9fa' : 'white',
                    color: poId ? '#6c757d' : '#212529',
                    minHeight: '60px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Compact Total Display */}
              <div style={{
                background: '#f8f9fa',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #dee2e6',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '9px', color: '#6c757d', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Header Total
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#28a745', fontFamily: 'monospace' }}>
                  ${totalCost.toFixed(2)}
                </div>
              </div>

              {!poId && (
                <button
                  type="submit"
                  disabled={loading || formData.source_id === 0}
                  style={{
                    padding: '8px 16px',
                    background: loading || formData.source_id === 0 ? '#6c757d' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: loading || formData.source_id === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  {loading && <span style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '50%', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }}>
                  </span>}
                  {loading ? 'Creating...' : 'Create PO'}
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Middle - Line Items Section */}
        <div style={{ 
          flex: showAddItemFlow ? '1' : '1',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden'
        }}>
          <div style={{ 
            padding: '10px 16px',
            borderBottom: '1px solid #dee2e6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
                Line Items
              </h3>
              <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '1px' }}>
                {lineItems.length} {lineItems.length === 1 ? 'item' : 'items'} | 
                Total: ${lineItemsTotal.toFixed(2)}
                {lineItems.length > 0 && (() => {
                  const manualItems = lineItems.filter(item => item.cost_assignment_method === 'manual');
                  const marketItems = lineItems.filter(item => item.cost_assignment_method === 'by_market_value');
                  
                  const manualTotal = manualItems.reduce((sum, item) => sum + (item.allocated_unit_cost || 0) * item.quantity_expected, 0);
                  const marketTotal = marketItems.reduce((sum, item) => {
                    if (success?.is_locked) {
                      return sum + (item.allocated_unit_cost || 0) * item.quantity_expected;
                    } else {
                      const simulatedCost = calculateSimulatedUnitCost(item);
                      return sum + (simulatedCost || 0) * item.quantity_expected;
                    }
                  }, 0);
                  
                  if (manualItems.length > 0 || marketItems.length > 0) {
                    return (
                      <span> | Manual: ${manualTotal.toFixed(2)} ({manualItems.length}) | Market: ${marketTotal.toFixed(2)} ({marketItems.length})</span>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
            
            {!success?.is_locked && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {poId && (
                  <button
                    onClick={() => setShowAddItemFlow(true)}
                    disabled={showAddItemFlow}
                    style={{
                      padding: '8px 16px',
                      background: showAddItemFlow ? '#6c757d' : '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: showAddItemFlow ? 'not-allowed' : 'pointer'
                    }}
                  >
                    + Add Item
                  </button>
                )}
                
                {lineItems.length > 0 && (
                  <button
                    onClick={handleLockPO}
                    disabled={loading}
                    style={{
                      padding: '8px 16px',
                      background: loading ? '#6c757d' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {loading && (
                      <span style={{ 
                        display: 'inline-block', 
                        width: '12px', 
                        height: '12px', 
                        border: '2px solid rgba(255,255,255,0.3)', 
                        borderRadius: '50%', 
                        borderTopColor: '#fff',
                        animation: 'spin 0.8s linear infinite'
                      }}></span>
                    )}
                    {loading ? 'Locking...' : '🔒 Lock PO'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {lineItems.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '9px' }}>Product</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '9px' }}>Variant</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '9px' }}>Qty</th>
                    {success?.is_locked ? (
                      <>
                        <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '9px' }}>Market Value</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '9px' }}>Final Cost</th>
                      </>
                    ) : (
                      <>
                        <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '9px' }}>Cost Basis</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '9px' }}>Est. Unit Cost</th>
                      </>
                    )}
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '9px' }}>Source</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '9px' }}>% Allocated</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '9px' }}>Total</th>
                    {!success?.is_locked && <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', fontSize: '9px' }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={item.purchase_order_item_id} style={{ 
                      borderBottom: '1px solid #e9ecef',
                      backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa'
                    }}>
                      <td style={{ padding: '6px 8px', fontWeight: '500', fontSize: '11px' }}>{item.product_title}</td>
                      <td style={{ padding: '6px 8px', color: '#6c757d', fontSize: '11px' }}>{item.variant_type_code}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                        {editingLineItemId === item.purchase_order_item_id ? (
                          <input
                            type="number"
                            value={editingLineItemData.quantity_expected}
                            onChange={(e) => handleLineItemEditChange('quantity_expected', parseInt(e.target.value) || 0)}
                            style={{
                              width: '60px',
                              padding: '2px 4px',
                              border: '1px solid #007bff',
                              borderRadius: '2px',
                              fontSize: '11px',
                              textAlign: 'center'
                            }}
                            min="0"
                          />
                        ) : (
                          item.quantity_expected
                        )}
                      </td>
                      {success?.is_locked ? (
                        <>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                            ${(item.allocation_basis || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#28a745' }}>
                            ${(item.allocated_unit_cost || 0).toFixed(2)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              {editingLineItemId === item.purchase_order_item_id && item.cost_assignment_method === 'manual' ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editingLineItemData.allocated_unit_cost || 0}
                                  onChange={(e) => handleLineItemEditChange('allocated_unit_cost', parseFloat(e.target.value) || 0)}
                                  style={{
                                    width: '70px',
                                    padding: '2px 4px',
                                    border: '1px solid #007bff',
                                    borderRadius: '2px',
                                    fontSize: '11px',
                                    textAlign: 'right',
                                    fontFamily: 'monospace'
                                  }}
                                />
                              ) : editingLineItemId === item.purchase_order_item_id && item.cost_assignment_method === 'by_market_value' ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editingLineItemData.allocation_basis || 0}
                                  onChange={(e) => handleLineItemEditChange('allocation_basis', parseFloat(e.target.value) || 0)}
                                  style={{
                                    width: '70px',
                                    padding: '2px 4px',
                                    border: '1px solid #007bff',
                                    borderRadius: '2px',
                                    fontSize: '11px',
                                    textAlign: 'right',
                                    fontFamily: 'monospace'
                                  }}
                                />
                              ) : (
                                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                                  ${item.cost_assignment_method === 'manual'
                                    ? (item.allocated_unit_cost || 0).toFixed(2)
                                    : (item.allocation_basis || 0).toFixed(2)
                                  }
                                </span>
                              )}
                              <span style={{ 
                                fontSize: '10px', 
                                color: item.cost_assignment_method === 'manual' ? '#dc3545' : '#007bff',
                                background: item.cost_assignment_method === 'manual' ? 'rgba(220, 53, 69, 0.1)' : 'rgba(0, 123, 255, 0.1)',
                                padding: '2px 6px',
                                borderRadius: '10px',
                                fontWeight: 'bold',
                                textTransform: 'uppercase'
                              }}>
                                {item.cost_assignment_method === 'manual' ? 'Paid' : 'Market'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            {(() => {
                              const estimatedCost = calculateSimulatedUnitCost(item);
                              if (estimatedCost === null) {
                                return <span style={{ color: '#6c757d', fontStyle: 'italic' }}>—</span>;
                              }
                              return (
                                <span style={{ 
                                  fontFamily: 'monospace',
                                  fontWeight: 'bold',
                                  color: '#28a745',
                                  background: 'rgba(40, 167, 69, 0.1)',
                                  padding: '4px 8px',
                                  borderRadius: '3px',
                                  fontSize: '12px'
                                }} title="Estimated unit cost if PO were locked now">
                                  ${estimatedCost.toFixed(2)}
                                </span>
                              );
                            })()}
                          </td>
                        </>
                      )}
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '11px',
                          background: item.allocation_basis_source === 'pricecharting' ? '#17a2b8' :
                                      item.allocation_basis_source === 'ebay_sold' ? '#ffc107' :
                                      item.cost_assignment_method === 'manual' ? '#6c757d' : '#343a40',
                          color: 'white',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}>
                          {item.allocation_basis_source === 'pricecharting' ? 'PC' :
                           item.allocation_basis_source === 'ebay_sold' ? 'eBay' :
                           item.cost_assignment_method === 'manual' ? 'Manual' : 'Other'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        {(() => {
                          const percentage = calculateItemPercentage(item);
                          if (percentage === null) {
                            return <span style={{ color: '#6c757d', fontStyle: 'italic' }}>—</span>;
                          }
                          return (
                            <span style={{
                              background: '#007bff',
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {percentage}%
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '15px' }}>
                        ${success?.is_locked
                          ? ((item.allocated_unit_cost || 0) * item.quantity_expected).toFixed(2)
                          : item.cost_assignment_method === 'manual'
                            ? ((item.allocated_unit_cost || 0) * item.quantity_expected).toFixed(2)
                            : (() => {
                                const simulatedCost = calculateSimulatedUnitCost(item);
                                return ((simulatedCost || 0) * item.quantity_expected).toFixed(2);
                              })()
                        }
                      </td>
                      {!success?.is_locked && (
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            {editingLineItemId === item.purchase_order_item_id ? (
                              <>
                                <button
                                  onClick={handleSaveLineItemChanges}
                                  disabled={loading}
                                  title="Save changes"
                                  style={{
                                    background: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    width: '20px',
                                    height: '20px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={handleCancelLineItemEdit}
                                  disabled={loading}
                                  title="Cancel edit"
                                  style={{
                                    background: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    width: '20px',
                                    height: '20px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStartEditLineItem(item)}
                                  title="Edit item"
                                  style={{
                                    background: '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    width: '20px',
                                    height: '20px',
                                    fontSize: '9px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  ✎
                                </button>
                                <button
                                  onClick={() => handleRemoveLineItem(item.purchase_order_item_id)}
                                  disabled={loading}
                                  title="Remove item"
                                  style={{
                                    background: loading ? '#6c757d' : '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    width: '20px',
                                    height: '20px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  ×
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ 
                padding: '60px 20px',
                textAlign: 'center',
                color: '#6c757d'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
                  📦
                </div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold' }}>
                  No Line Items Yet
                </h4>
                <p style={{ margin: '0 0 24px 0', fontSize: '14px' }}>
                  Add products to this purchase order to begin tracking inventory and costs.
                </p>
                {poId && !showAddItemFlow && (
                  <button
                    onClick={() => setShowAddItemFlow(true)}
                    style={{
                      padding: '12px 24px',
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    + Add First Item
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Right Side - Add Line Item Flow */}
        {showAddItemFlow && (
          <div style={{ 
            width: '400px',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            maxHeight: '100%'
          }}>
            <AddLineItemFlow
              categories={categories}
              platforms={platforms}
              variantTypes={variantTypes}
              currentLineItems={lineItems}
              onAddItem={handleAddLineItem}
              onCancel={() => setShowAddItemFlow(false)}
            />
          </div>
        )}
      </div>
      
      {/* Ultra Compact Bottom Summary Bar */}
      {poId && (
        <div style={{
          background: '#f8f9fa',
          padding: '4px 12px',
          borderRadius: '3px',
          border: '1px solid #dee2e6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          height: '24px'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '8px', color: '#6c757d', textTransform: 'uppercase' }}>Header: </span>
              <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                ${totalCost.toFixed(2)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '8px', color: '#6c757d', textTransform: 'uppercase' }}>Items: </span>
              <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                ${lineItemsTotal.toFixed(2)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '8px', color: '#6c757d', textTransform: 'uppercase' }}>Count: </span>
              <span style={{ fontSize: '10px', fontWeight: 'bold' }}>
                {lineItems.length}
              </span>
            </div>
          </div>
          
          <div style={{ fontSize: '9px', color: '#6c757d', fontFamily: 'monospace' }}>
            {success?.is_locked 
              ? `✓ ${success.po_number} Locked`
              : `${success?.po_number} Ready`
            }
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderCreate;
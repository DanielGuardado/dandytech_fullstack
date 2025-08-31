import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiService } from '../services/api';
import { calculatorService } from '../services/calculatorService';
import { 
  Source, 
  PaymentMethod, 
  Category, 
  Platform,
  VariantType
} from '../types/api';
import {
  CalculatorSession,
  CalculatorSessionDetail,
  CalculatorItem,
  CalculatorConfig
} from '../types/calculator';
import CalculatorSessionSelector from './CalculatorSessionSelector';
import AddCalculatorItemFlow from './AddCalculatorItemFlow';
import CalculatorItemTable from './CalculatorItemTable';
import CalculatorConfigPanel from './CalculatorConfigPanel';
import ConvertToPOModal from './ConvertToPOModal';

const PurchaseCalculator: React.FC = () => {
  // Session state
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionData, setSessionData] = useState<CalculatorSessionDetail | null>(null);
  const [items, setItems] = useState<CalculatorItem[]>([]);

  // Configuration state
  const [config, setConfig] = useState<Record<string, CalculatorConfig>>({});
  
  // Lookup data
  const [sources, setSources] = useState<Source[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddItemFlow, setShowAddItemFlow] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Editing state
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItemData, setEditingItemData] = useState<any>(null);

  // Refs
  const itemsTableRef = useRef<HTMLDivElement>(null);

  // Helper function for consistent focus styling
  const addFocusHandlers = () => ({
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      e.target.style.borderColor = '#007aff';
      e.target.style.boxShadow = '0 0 0 3px rgba(0, 122, 255, 0.15)';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      e.target.style.borderColor = '#dee2e6';
      e.target.style.boxShadow = 'none';
    }
  });

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        
        // Load lookups and config in parallel
        const [lookups, calculatorConfig] = await Promise.all([
          apiService.getLookups(),
          calculatorService.getConfig()
        ]);
        
        setSources(lookups.sources);
        setPaymentMethods(lookups.payment_methods);
        setCategories(lookups.categories);
        setPlatforms(lookups.platforms);
        setVariantTypes(lookups.variant_types);
        setConfig(calculatorConfig);
        
      } catch (err) {
        setError(`Failed to load initial data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const handleSessionSelect = async (session: CalculatorSession | null) => {
    if (session) {
      try {
        setLoading(true);
        const sessionDetail = await calculatorService.getSession(session.session_id);
        
        
        setSessionData(sessionDetail);
        setSessionId(session.session_id);
        setItems(sessionDetail.items || []);
        setHasUnsavedChanges(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    } else {
      // Create new session
      try {
        setLoading(true);
        const newSession = await calculatorService.createSession({
          session_name: calculatorService.generateSessionName(sources[0]?.name)
        });
        
        const sessionDetail = await calculatorService.getSession(newSession.session_id);
        setSessionData(sessionDetail);
        setSessionId(newSession.session_id);
        setItems([]);
        setHasUnsavedChanges(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create session');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddItem = async (itemData: any) => {
    if (!sessionId) return;
    
    try {
      setLoading(true);
      const newItem = await calculatorService.addItem(sessionId, itemData);
      
      // Add new item to state array instead of refetching entire session
      setItems(prev => [...prev, newItem]);
      
      // Auto-scroll to new item
      setTimeout(() => {
        itemsTableRef.current?.scrollTo({
          top: itemsTableRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
      
      // Keep the AddItemFlow open for continuous item addition - it will reset to search automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = async (itemId: number, updates: any) => {
    if (!sessionId) return;
    
    try {
      setLoading(true);
      const updatedItem = await calculatorService.updateItem(sessionId, itemId, updates);
      
      // Update the specific item in the state array
      setItems(prev => prev.map(item => 
        item.item_id === itemId ? updatedItem : item
      ));
      
      setEditingItemId(null);
      setEditingItemData(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!sessionId) return;
    
    try {
      setLoading(true);
      await calculatorService.deleteItem(sessionId, itemId);
      
      // Remove the item from the state array
      setItems(prev => prev.filter(item => item.item_id !== itemId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToPO = async (poData: any) => {
    if (!sessionId) return;
    
    try {
      setLoading(true);
      const result = await calculatorService.convertToPurchaseOrder(sessionId, poData);
      
      // Update session status
      const updatedSession = await calculatorService.getSession(sessionId);
      setSessionData(updatedSession);
      
      setShowConvertModal(false);
      
      // Show success message with PO link
      alert(`Successfully created PO ${result.po_number} with ${result.items_converted} items!`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert to PO');
    } finally {
      setLoading(false);
    }
  };

  const canAddItems = sessionData?.status !== 'converted_to_po';
  const canConvert = calculatorService.canConvertToPO(sessionData || {} as CalculatorSession);

  // Calculate session totals from items for dynamic updates
  const calculatedTotals = useMemo(() => {
    if (!items.length) {
      return {
        total_items: 0,
        total_market_value: 0,
        total_estimated_revenue: 0,
        total_purchase_price: 0,
        expected_profit: 0,
        expected_profit_margin: 0,
        average_percent_of_market: 0,
        average_roi: 0
      };
    }
    return calculatorService.calculateSessionTotals(items);
  }, [items]);

  // Create dynamic session data with calculated totals
  const dynamicSessionData = useMemo(() => {
    if (!sessionData) return null;
    return {
      ...sessionData,
      ...calculatedTotals
    };
  }, [sessionData, calculatedTotals]);

  return (
    <div style={{ 
      height: '100%', 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      padding: '4px'
    }}>
      
      {/* Session Selector Bar - Compact Header */}
      <div style={{ 
        display: 'flex', 
        gap: '12px',
        alignItems: 'center',
        flexShrink: 0,
        height: '48px'
      }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <CalculatorSessionSelector 
            currentSessionId={sessionId}
            onSessionSelect={handleSessionSelect}
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
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#495057' }}>
            Purchase Calculator
          </span>
          
          {/* Status Indicator */}
          {dynamicSessionData && (
            <div style={{
              background: 
                dynamicSessionData.status === 'converted_to_po' ? '#dc3545' :
                dynamicSessionData.status === 'finalized' ? '#28a745' : '#007bff',
              color: 'white',
              padding: '1px 6px',
              borderRadius: '8px',
              fontSize: '8px',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              {dynamicSessionData.status === 'converted_to_po' ? 'Converted' :
               dynamicSessionData.status === 'finalized' ? 'Finalized' : 'Draft'}
            </div>
          )}
        </div>

        {/* Compact Summary */}
        <div style={{ 
          fontSize: '10px', 
          color: '#6c757d',
          fontFamily: 'monospace'
        }}>
          {dynamicSessionData ? (
            `${dynamicSessionData.total_items} items | Revenue: ${calculatorService.formatCurrency(dynamicSessionData.total_estimated_revenue || 0)} | Profit: ${calculatorService.formatPercentage(dynamicSessionData.expected_profit_margin || 0)}`
          ) : (
            'No session selected'
          )}
        </div>
      </div>
      
      {/* Error Message */}
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
          <button 
            onClick={() => setError(null)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#721c24', 
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Content Area - 3 Column Layout */}
      <div style={{ 
        display: 'flex', 
        flex: 1,
        gap: '8px',
        minHeight: 0,
        overflow: 'hidden'
      }}>
        
        {/* Left Side - Session Details & Config */}
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
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#1d1d1f' }}>
              Session Details
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setShowConfigPanel(!showConfigPanel)}
                style={{
                  background: showConfigPanel ? '#28a745' : '#6c757d',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '2px',
                  fontSize: '8px',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Config
              </button>
            </div>
          </div>
          
          <div style={{ 
            padding: '8px', 
            flex: 1, 
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {dynamicSessionData ? (
              <>
                {/* Session Info */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#6c757d', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Session Name
                  </label>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#495057',
                    background: '#f8f9fa',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #dee2e6'
                  }}>
                    {dynamicSessionData.session_name || 'Unnamed Session'}
                  </div>
                </div>

                {/* Asking Price Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#6c757d', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Asking Price 💰
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter seller's asking price for entire lot"
                    value={sessionData?.asking_price?.toString() || ''}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      const numericValue = inputValue === '' ? undefined : parseFloat(inputValue);
                      setSessionData(prev => prev ? { ...prev, asking_price: numericValue } : prev);
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#007aff';
                      e.target.style.boxShadow = '0 0 0 3px rgba(0, 122, 255, 0.15)';
                    }}
                    onBlur={async (e) => {
                      e.target.style.borderColor = '#dee2e6';
                      e.target.style.boxShadow = 'none';
                      
                      // Check if Enter was just pressed to avoid duplicate API calls
                      const enterPressed = e.target.getAttribute('data-enter-pressed');
                      if (enterPressed) {
                        e.target.removeAttribute('data-enter-pressed');
                        return;
                      }
                      
                      const inputValue = e.target.value;
                      const numericValue = inputValue === '' ? undefined : parseFloat(inputValue);
                      
                      if (sessionId) {
                        try {
                          await calculatorService.updateSession(sessionId, { asking_price: numericValue });
                          setSessionData(prev => prev ? { ...prev, asking_price: numericValue } : prev);
                        } catch (err) {
                          setError(`Failed to update asking price: ${err instanceof Error ? err.message : 'Unknown error'}`);
                        }
                      }
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        const inputValue = (e.target as HTMLInputElement).value;
                        const numericValue = inputValue === '' ? undefined : parseFloat(inputValue);
                        
                        if (sessionId) {
                          try {
                            await calculatorService.updateSession(sessionId, { asking_price: numericValue });
                            setSessionData(prev => prev ? { ...prev, asking_price: numericValue } : prev);
                            // Set a flag to prevent blur from firing immediately after Enter
                            (e.target as HTMLInputElement).setAttribute('data-enter-pressed', 'true');
                            (e.target as HTMLInputElement).blur();
                          } catch (err) {
                            setError(`Failed to update asking price: ${err instanceof Error ? err.message : 'Unknown error'}`);
                          }
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      textAlign: 'right'
                    }}
                  />
                </div>

                {/* Estimated Summary Stats */}
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#495057' }}>
                    Estimated Summary
                  </h4>
                  
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e9ecef' }}>
                      <span style={{ fontSize: '12px', color: '#6c757d' }}>Items:</span>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace' }}>{dynamicSessionData.total_items}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e9ecef' }}>
                      <span style={{ fontSize: '12px', color: '#6c757d' }}>Market Value:</span>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: '#007bff' }}>
                        {calculatorService.formatCurrency(dynamicSessionData.total_market_value || 0)}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e9ecef' }}>
                      <span style={{ fontSize: '12px', color: '#6c757d' }}>Revenue:</span>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: '#28a745' }}>
                        {calculatorService.formatCurrency(dynamicSessionData.total_estimated_revenue || 0)}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e9ecef' }}>
                      <span style={{ fontSize: '12px', color: '#6c757d' }}>Max Purchase:</span>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: '#dc3545' }}>
                        {calculatorService.formatCurrency(dynamicSessionData.total_purchase_price || 0)}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e9ecef' }}>
                      <span style={{ fontSize: '12px', color: '#6c757d' }}>Total Expected Profit:</span>
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: 'bold', 
                        fontFamily: 'monospace',
                        color: (dynamicSessionData.expected_profit || 0) >= 0 ? '#28a745' : '#dc3545'
                      }}>
                        {calculatorService.formatCurrency(dynamicSessionData.expected_profit || 0)}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e9ecef' }}>
                      <span 
                        style={{ fontSize: '12px', color: '#6c757d', cursor: 'help' }}
                        title="Percentage of revenue kept as profit after all costs. (Profit ÷ Revenue)"
                      >
                        Profit Margin 📊:
                      </span>
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: 'bold', 
                        fontFamily: 'monospace',
                        color: calculatorService.getProfitMarginColor(dynamicSessionData.expected_profit_margin || 0)
                      }}>
                        {calculatorService.formatPercentage(dynamicSessionData.expected_profit_margin || 0)}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e9ecef' }}>
                      <span 
                        style={{ fontSize: '12px', color: '#6c757d', cursor: 'help' }}
                        title="Average percentage of market price you're paying across all items. Higher is better for resale value."
                      >
                        Avg % of Market 🎯:
                      </span>
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: 'bold', 
                        fontFamily: 'monospace',
                        color: calculatorService.getPercentOfMarketColor(dynamicSessionData.average_percent_of_market || 0)
                      }}>
                        {calculatorService.formatPercentage(dynamicSessionData.average_percent_of_market || 0)}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e9ecef' }}>
                      <span 
                        style={{ fontSize: '12px', color: '#6c757d', cursor: 'help' }}
                        title="Average return on investment. Shows profit as percentage of cost. (Profit ÷ Cost)"
                      >
                        Avg ROI 📈:
                      </span>
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: 'bold', 
                        fontFamily: 'monospace',
                        color: calculatorService.getROIColor(dynamicSessionData.average_roi || 0)
                      }}>
                        {calculatorService.formatPercentage(dynamicSessionData.average_roi || 0)}
                      </span>
                    </div>

                    {/* Asking Price Comparison */}
                    {dynamicSessionData.asking_price && dynamicSessionData.total_purchase_price && (() => {
                      const dealQuality = calculatorService.getDealQualityRating(dynamicSessionData.asking_price, dynamicSessionData.total_purchase_price);
                      const profitAtAsking = calculatorService.calculateProfitAtAskingPrice(dynamicSessionData.total_estimated_revenue || 0, dynamicSessionData.asking_price);
                      const marginAtAsking = calculatorService.calculateMarginAtAskingPrice(dynamicSessionData.total_estimated_revenue || 0, dynamicSessionData.asking_price);
                      const roiAtAsking = calculatorService.calculateROIAtAskingPrice(dynamicSessionData.total_estimated_revenue || 0, dynamicSessionData.asking_price);
                      const percentOfMarket = calculatorService.calculatePercentOfMarketForAskingPrice(dynamicSessionData.asking_price, dynamicSessionData.total_market_value || 0);

                      return (
                        <div style={{ 
                          background: '#f8f9fa',
                          margin: '4px -4px',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #dee2e6'
                        }}>
                          {/* Header Comparison */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span 
                              style={{ fontSize: '12px', color: '#6c757d', cursor: 'help' }}
                              title="Comparison of seller's asking price vs your calculated maximum purchase price"
                            >
                              Asking vs Max 💰:
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span style={{ 
                                fontSize: '12px', 
                                fontWeight: 'bold', 
                                fontFamily: 'monospace',
                                color: dealQuality.color
                              }}>
                                {calculatorService.formatCurrency(dynamicSessionData.asking_price)} vs {calculatorService.formatCurrency(dynamicSessionData.total_purchase_price)}
                              </span>
                              <span style={{ 
                                fontSize: '10px', 
                                fontWeight: 'bold',
                                color: dealQuality.color
                              }}>
                                {dynamicSessionData.asking_price <= dynamicSessionData.total_purchase_price ? 
                                  `✅ GOOD DEAL (Save $${calculatorService.formatCurrency(dynamicSessionData.total_purchase_price - dynamicSessionData.asking_price).replace('$', '')}) | ${dealQuality.percentage.toFixed(0)}% of max` : 
                                  `❌ OVERPRICED ($${calculatorService.formatCurrency(dynamicSessionData.asking_price - dynamicSessionData.total_purchase_price).replace('$', '')} over) | ${dealQuality.percentage.toFixed(0)}% of max`
                                }
                              </span>
                            </div>
                          </div>

                          {/* Detailed Metrics */}
                          <div style={{ 
                            borderTop: '1px solid #dee2e6',
                            paddingTop: '8px',
                            fontSize: '11px',
                            display: 'grid',
                            gap: '4px'
                          }}>
                            <div style={{ fontWeight: 'bold', color: '#495057', marginBottom: '4px' }}>
                              📊 If Buying at Asking Price:
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#6c757d' }}>Profit:</span>
                              <span style={{ 
                                fontFamily: 'monospace', 
                                fontWeight: 'bold',
                                color: profitAtAsking >= 0 ? '#28a745' : '#dc3545'
                              }}>
                                {calculatorService.formatCurrency(profitAtAsking)} <span style={{ color: '#6c757d', fontSize: '9px' }}>(was {calculatorService.formatCurrency(dynamicSessionData.expected_profit || 0)})</span>
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#6c757d' }}>Margin:</span>
                              <span style={{ 
                                fontFamily: 'monospace', 
                                fontWeight: 'bold',
                                color: calculatorService.getProfitMarginColor(marginAtAsking)
                              }}>
                                {calculatorService.formatPercentage(marginAtAsking)} <span style={{ color: '#6c757d', fontSize: '9px' }}>(was {calculatorService.formatPercentage(dynamicSessionData.expected_profit_margin || 0)})</span>
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#6c757d' }}>ROI:</span>
                              <span style={{ 
                                fontFamily: 'monospace', 
                                fontWeight: 'bold',
                                color: calculatorService.getROIColor(roiAtAsking)
                              }}>
                                {calculatorService.formatPercentage(roiAtAsking)} <span style={{ color: '#6c757d', fontSize: '9px' }}>(was {calculatorService.formatPercentage(dynamicSessionData.average_roi || 0)})</span>
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#6c757d' }}>% of Market:</span>
                              <span style={{ 
                                fontFamily: 'monospace', 
                                fontWeight: 'bold',
                                color: calculatorService.getPercentOfMarketColor(percentOfMarket)
                              }}>
                                {calculatorService.formatPercentage(percentOfMarket)}
                              </span>
                            </div>

                            <div style={{ 
                              marginTop: '6px',
                              paddingTop: '6px',
                              borderTop: '1px solid #dee2e6',
                              display: 'flex', 
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <span style={{ color: '#6c757d', fontWeight: 'bold' }}>Deal Rating:</span>
                              <span style={{ 
                                fontWeight: 'bold',
                                color: dealQuality.color,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                {dealQuality.emoji} {dealQuality.rating} ({dealQuality.percentage.toFixed(1)}% of max)
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {canConvert && (
                    <button
                      onClick={() => setShowConvertModal(true)}
                      disabled={loading}
                      style={{
                        padding: '8px 16px',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      📋 Convert to PO
                    </button>
                  )}
                </div>

                {/* Config Panel */}
                {showConfigPanel && (
                  <CalculatorConfigPanel 
                    config={config}
                    platforms={platforms}
                    onUpdateConfig={async (updates) => {
                      const newConfig = await calculatorService.updateConfig(updates);
                      setConfig(newConfig);
                    }}
                    onUpdatePlatformMarkup={async (platformId, markup) => {
                      await calculatorService.updatePlatformMarkup(platformId, markup);
                      // Refresh platforms
                      const lookups = await apiService.getLookups();
                      setPlatforms(lookups.platforms);
                    }}
                  />
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#6c757d', fontSize: '14px', padding: '20px' }}>
                Select or create a session to get started
              </div>
            )}
          </div>
        </div>
        
        {/* Middle - Items Table */}
        <div style={{ 
          flex: 1,
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}>
          <div style={{ 
            padding: '6px 12px',
            borderBottom: '1px solid #dee2e6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            minHeight: '40px'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#1d1d1f' }}>
                Calculator Items
              </h3>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                {items.length} {items.length === 1 ? 'item' : 'items'}
                {dynamicSessionData && dynamicSessionData.total_estimated_revenue && (
                  <span> | Revenue: {calculatorService.formatCurrency(dynamicSessionData.total_estimated_revenue)}</span>
                )}
              </div>
            </div>
            
            {canAddItems && (
              <button
                onClick={() => setShowAddItemFlow(true)}
                disabled={showAddItemFlow || !sessionId}
                style={{
                  padding: '8px 16px',
                  background: showAddItemFlow || !sessionId ? '#6c757d' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: showAddItemFlow || !sessionId ? 'not-allowed' : 'pointer'
                }}
              >
                + Add Item
              </button>
            )}
          </div>

          <div ref={itemsTableRef} style={{ flex: 1, overflow: 'auto' }}>
            <CalculatorItemTable 
              items={items}
              platforms={platforms}
              loading={loading}
              editingItemId={editingItemId}
              editingItemData={editingItemData}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onStartEdit={(itemId, itemData) => {
                setEditingItemId(itemId);
                setEditingItemData(itemData);
              }}
              onCancelEdit={() => {
                setEditingItemId(null);
                setEditingItemData(null);
              }}
              canEdit={canAddItems}
            />
          </div>
        </div>
        
        {/* Right Side - Add Item Flow (when active) */}
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
            <AddCalculatorItemFlow 
              categories={categories}
              platforms={platforms}
              variantTypes={variantTypes}
              config={config}
              onAddItem={handleAddItem}
              onCancel={() => setShowAddItemFlow(false)}
            />
          </div>
        )}
      </div>

      {/* Convert to PO Modal */}
      {showConvertModal && dynamicSessionData && (
        <ConvertToPOModal 
          session={dynamicSessionData}
          sources={sources}
          onConvert={handleConvertToPO}
          onCancel={() => setShowConvertModal(false)}
          loading={loading}
        />
      )}
    </div>
  );
};

export default PurchaseCalculator;
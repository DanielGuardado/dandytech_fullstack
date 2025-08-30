import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PurchaseOrderList from './PurchaseOrderList';

interface DashboardStats {
  activeListings: number;
  pendingReceive: number;
  monthSales: number;
  totalRevenue: number;
  openPOs: number;
  receivedToday: number;
  lowStock: number;
  recentOrders: number;
}

interface QuickAction {
  id: string;
  label: string;
  shortcut: string;
  icon: string;
  action: () => void;
  count?: number;
  urgent?: boolean;
  description: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedAction, setSelectedAction] = useState(0);
  const [focusContext, setFocusContext] = useState<'actions' | 'table'>('actions');
  const actionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    activeListings: 247,
    pendingReceive: 18,
    monthSales: 1205,
    totalRevenue: 45320,
    openPOs: 5,
    receivedToday: 12,
    lowStock: 3,
    recentOrders: 28
  });

  const quickActions: QuickAction[] = [
    { 
      id: 'create-po', 
      label: 'Create Purchase Order', 
      shortcut: 'Ctrl+1', 
      icon: '📦', 
      action: () => navigate('/purchase-orders/create'), 
      count: stats.openPOs,
      description: 'Start new PO from marketplace sources'
    },
    { 
      id: 'receiving', 
      label: 'Process Receiving', 
      shortcut: 'Ctrl+2', 
      icon: '📥', 
      action: () => navigate('/receiving'), 
      count: stats.pendingReceive, 
      urgent: stats.pendingReceive > 15,
      description: 'Receive incoming inventory items'
    },
    { 
      id: 'inventory', 
      label: 'Manage Inventory', 
      shortcut: 'Ctrl+3', 
      icon: '📋', 
      action: () => navigate('/inventory'), 
      count: stats.activeListings,
      description: 'View and manage current listings'
    },
    { 
      id: 'analytics', 
      label: 'View Analytics', 
      shortcut: 'Ctrl+4', 
      icon: '📊', 
      action: () => navigate('/analytics'),
      description: 'Sales performance and metrics'
    },
    { 
      id: 'catalog', 
      label: 'Search Catalog', 
      shortcut: 'Ctrl+5', 
      icon: '🔍', 
      action: () => navigate('/catalog'),
      description: 'Find and manage product catalog'
    },
    { 
      id: 'settings', 
      label: 'System Settings', 
      shortcut: 'Ctrl+6', 
      icon: '⚙️', 
      action: () => navigate('/settings'),
      description: 'Configure sources and preferences'
    }
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const actionIndex = parseInt(e.key) - 1;
        if (actionIndex >= 0 && actionIndex < quickActions.length) {
          e.preventDefault();
          quickActions[actionIndex].action();
        }
      }

      if (e.key >= '1' && e.key <= '6') {
        const index = parseInt(e.key) - 1;
        if (quickActions[index]) {
          e.preventDefault();
          setFocusContext('actions');
          setSelectedAction(index);
          actionRefs.current[index]?.focus();
        }
      }

      if (e.key === 'Enter' && selectedAction >= 0 && focusContext === 'actions') {
        e.preventDefault();
        quickActions[selectedAction]?.action();
      }

      if (e.key === 'ArrowRight' && focusContext === 'actions') {
        e.preventDefault();
        setSelectedAction(prev => Math.min(prev + 1, quickActions.length - 1));
      }

      if (e.key === 'ArrowLeft' && focusContext === 'actions') {
        e.preventDefault();
        setSelectedAction(prev => Math.max(prev - 1, 0));
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        setFocusContext(prev => prev === 'actions' ? 'table' : 'actions');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedAction, quickActions, focusContext]);

  return (
    <div className="dashboard" style={{ 
      padding: '16px', 
      height: '100%', 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      
      {/* Top Stats Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: '#f8f9fa',
        padding: '12px 20px',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                ${stats.totalRevenue.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase' }}>
                Total Revenue
              </div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {stats.monthSales}
              </div>
              <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase' }}>
                Month Sales
              </div>
            </div>
          </div>
          
          <div style={{ width: '1px', height: '40px', background: '#dee2e6' }} />
          
          <div style={{ display: 'flex', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                {stats.activeListings}
              </div>
              <div style={{ fontSize: '11px', color: '#6c757d', textTransform: 'uppercase' }}>
                Active Listings
              </div>
            </div>
            <div>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: 'bold', 
                color: stats.pendingReceive > 15 ? '#dc3545' : '#000' 
              }}>
                {stats.pendingReceive}
              </div>
              <div style={{ fontSize: '11px', color: '#6c757d', textTransform: 'uppercase' }}>
                Pending Receive
              </div>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                {stats.receivedToday}
              </div>
              <div style={{ fontSize: '11px', color: '#6c757d', textTransform: 'uppercase' }}>
                Received Today
              </div>
            </div>
            <div>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: 'bold',
                color: stats.lowStock > 0 ? '#ffc107' : '#000'
              }}>
                {stats.lowStock}
              </div>
              <div style={{ fontSize: '11px', color: '#6c757d', textTransform: 'uppercase' }}>
                Low Stock Items
              </div>
            </div>
          </div>
        </div>

        <div style={{ 
          fontSize: '12px', 
          color: '#6c757d',
          background: '#fff',
          padding: '6px 12px',
          borderRadius: '4px',
          border: '1px solid #dee2e6'
        }}>
          Ctrl+1-6: Quick Actions | Tab: Switch Focus | {focusContext === 'actions' ? '←→: Navigate Cards' : '↑↓: Navigate Table'} | Enter: Execute
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        gap: '16px',
        minHeight: 0
      }}>
        
        {/* Left Side - Quick Actions */}
        <div style={{ 
          width: '320px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          
          {/* Quick Actions Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px'
          }}>
            {quickActions.map((action, index) => (
              <div
                key={action.id}
                ref={el => actionRefs.current[index] = el}
                style={{
                  border: `2px solid ${
                    selectedAction === index && focusContext === 'actions' 
                      ? '#007bff' 
                      : action.urgent 
                        ? '#dc3545' 
                        : '#dee2e6'
                  }`,
                  borderRadius: '8px',
                  padding: '16px',
                  cursor: 'pointer',
                  background: selectedAction === index && focusContext === 'actions' 
                    ? '#f8f9ff' 
                    : action.urgent 
                      ? '#fff5f5' 
                      : '#fff',
                  opacity: focusContext === 'table' ? 0.7 : 1,
                  transition: 'all 0.2s',
                  minHeight: '100px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
                onClick={action.action}
                onMouseEnter={() => {
                  setFocusContext('actions');
                  setSelectedAction(index);
                }}
                tabIndex={0}
                role="button"
                aria-label={`${action.label} - ${action.shortcut}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '24px' }}>{action.icon}</span>
                  <span style={{ 
                    fontSize: '12px', 
                    background: '#e9ecef', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}>
                    {action.shortcut.replace('Ctrl+', '')}
                  </span>
                </div>
                
                <div>
                  <h4 style={{ 
                    margin: '8px 0 4px 0', 
                    fontSize: '14px', 
                    fontWeight: 'bold',
                    lineHeight: 1.2
                  }}>
                    {action.label}
                  </h4>
                  {action.count !== undefined && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: action.urgent ? '#dc3545' : '#6c757d',
                      fontWeight: action.urgent ? 'bold' : 'normal'
                    }}>
                      {action.count} {action.count === 1 ? 'item' : 'items'}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                    {action.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Today's Activity */}
          <div style={{
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            background: '#fff'
          }}>
            <div style={{ 
              padding: '16px 20px 12px 20px',
              borderBottom: '1px solid #dee2e6'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Today's Activity</h3>
            </div>
            <div style={{ padding: '12px 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>📦</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{stats.recentOrders} Orders Created</div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>Last 24 hours</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>📥</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{stats.receivedToday} Items Received</div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>Today</div>
                  </div>
                </div>
                {stats.lowStock > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    padding: '8px',
                    background: '#fff3cd',
                    borderRadius: '4px',
                    border: '1px solid #ffeaa7'
                  }}>
                    <span style={{ fontSize: '20px' }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#856404' }}>
                        {stats.lowStock} Low Stock Alerts
                      </div>
                      <div style={{ fontSize: '12px', color: '#856404' }}>Requires attention</div>
                    </div>
                    <button 
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        background: '#ffc107',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      onClick={() => navigate('/inventory?filter=low-stock')}
                    >
                      Review →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Purchase Orders Table */}
        <div style={{ 
          flex: 1,
          border: `2px solid ${focusContext === 'table' ? '#007bff' : '#dee2e6'}`,
          borderRadius: '8px',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          opacity: focusContext === 'actions' ? 0.85 : 1,
          transition: 'all 0.2s'
        }}>
          <div style={{ 
            padding: '16px 20px',
            borderBottom: '1px solid #dee2e6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Purchase Orders</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                style={{
                  padding: '8px 16px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
                onClick={() => navigate('/purchase-orders/create')}
              >
                + New PO
              </button>
              <button 
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  color: '#007bff',
                  border: '1px solid #007bff',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
                onClick={() => navigate('/purchase-orders')}
              >
                View All
              </button>
            </div>
          </div>
          
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <PurchaseOrderList 
              limit={15} 
              showTitle={false} 
              showViewAll={false}
              focusContext={focusContext}
              onFocusChange={setFocusContext}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
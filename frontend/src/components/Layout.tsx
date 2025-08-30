import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === '/';

  const handleBackToDashboard = () => {
    navigate('/');
  };

  const getPageTitle = () => {
    if (location.pathname === '/purchase-orders/create') return 'Create Purchase Order';
    if (location.pathname === '/purchase-orders') return 'Purchase Orders';
    if (location.pathname.startsWith('/purchase-orders/')) return 'Purchase Order Details';
    if (location.pathname === '/receiving') return 'Receiving';
    if (location.pathname.startsWith('/receiving/')) return 'Receiving';
    if (location.pathname === '/inventory') return 'Inventory Management';
    if (location.pathname.startsWith('/inventory/')) return 'Inventory';
    if (location.pathname === '/calculator') return 'Purchase Calculator';
    return '';
  };

  return (
    <div className="App">
      {!isDashboard && (
        <div className="app-nav" style={{ 
          padding: '4px 8px', 
          background: '#f8f9fa', 
          borderBottom: '1px solid #dee2e6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '32px',
          flexShrink: 0
        }}>
          <button 
            className="back-button" 
            onClick={handleBackToDashboard}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              border: '1px solid #007bff',
              borderRadius: '3px',
              color: '#007bff',
              fontSize: '10px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ← Dashboard
          </button>
          <h1 style={{ 
            margin: 0, 
            fontSize: '14px', 
            fontWeight: 'bold', 
            color: '#495057',
            flex: 1,
            textAlign: 'center'
          }}>
            {getPageTitle()}
          </h1>
          <div style={{ width: '60px' }}></div> {/* Spacer to center the title */}
        </div>
      )}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {children}
      </div>
    </div>
  );
};

export default Layout;
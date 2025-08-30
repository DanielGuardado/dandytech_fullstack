import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PurchaseOrderCreate from './components/PurchaseOrderCreate';
import PurchaseOrderList from './components/PurchaseOrderList';
import PurchaseOrderDetail from './components/PurchaseOrderDetail';
import Receiving from './components/Receiving';
import Inventory from './components/Inventory';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/purchase-orders" element={
            <>
              <header className="App-header">
                <h1>Purchase Orders</h1>
              </header>
              <main>
                <PurchaseOrderList />
              </main>
            </>
          } />
          <Route path="/purchase-orders/create" element={
            <PurchaseOrderCreate />
          } />
          <Route path="/purchase-orders/:id" element={
            <>
              <header className="App-header">
                <h1>Purchase Order Details</h1>
              </header>
              <main>
                <PurchaseOrderDetail />
              </main>
            </>
          } />
          <Route path="/receiving" element={<Receiving />} />
          <Route path="/receiving/:id" element={<Receiving />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/inventory/po/:poId" element={<Inventory />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
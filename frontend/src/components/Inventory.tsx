import React from 'react';
import { useParams } from 'react-router-dom';
import InventoryList from './InventoryList';
import InventoryGrid from './InventoryGrid';

const Inventory: React.FC = () => {
  const { poId } = useParams<{ poId: string }>();
  
  // If we have a PO ID, show just the grid for that PO
  if (poId) {
    return <InventoryGrid poId={parseInt(poId)} />;
  }
  
  // Otherwise, show the full inventory management interface
  return <InventoryList />;
};

export default Inventory;
import React from 'react';
import { useParams } from 'react-router-dom';
import ReceivingList from './ReceivingList';
import ReceivingGrid from './ReceivingGrid';

const Receiving: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  
  if (id) {
    return <ReceivingGrid poId={parseInt(id)} />;
  }
  
  return <ReceivingList />;
};

export default Receiving;
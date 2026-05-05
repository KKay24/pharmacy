import React, { useContext } from 'react';
import ProfitLoss from '../components/ProfitLoss';
import { DataContext } from '../context/DataContext';

export default function ProfitLossPage() {
  const { inventory, sales, resetProfitLossData } = useContext(DataContext);
  
  return (
    <ProfitLoss 
      inventory={inventory} 
      sales={sales} 
      resetProfitLossData={() => resetProfitLossData && resetProfitLossData()} // Safety check
    />
  );
}

import React, { useState } from 'react';
import { 
  Category, 
  Platform, 
  VariantType,
} from '../types/api';
import {
  CalculatorConfig,
  CalculatorItemCreate
} from '../types/calculator';

interface AddCalculatorItemFlowProps {
  categories: Category[];
  platforms: Platform[];
  variantTypes: VariantType[];
  config: Record<string, CalculatorConfig>;
  onAddItem: (item: CalculatorItemCreate) => void;
  onCancel: () => void;
}

const AddCalculatorItemFlow: React.FC<AddCalculatorItemFlowProps> = ({
  categories,
  platforms,
  variantTypes,
  config,
  onAddItem,
  onCancel
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex',
      flexDirection: 'column',
      padding: '8px'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '4px 8px',
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
        minHeight: '32px',
        marginBottom: '8px'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#1d1d1f' }}>
          Add Calculator Item
        </h3>
        
        <button
          onClick={onCancel}
          style={{
            background: '#6c757d',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '2px',
            fontSize: '10px',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>

      {/* Content */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6c757d',
        fontSize: '14px'
      }}>
        🚧 Component under construction
        <br />
        This will extend AddLineItemFlow with calculator-specific fields
      </div>
    </div>
  );
};

export default AddCalculatorItemFlow;
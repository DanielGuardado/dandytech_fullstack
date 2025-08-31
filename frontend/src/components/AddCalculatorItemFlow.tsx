import React from 'react';
import { 
  Category, 
  Platform, 
  VariantType,
} from '../types/api';
import {
  CalculatorConfig,
  CalculatorItemCreate
} from '../types/calculator';
import AddLineItemFlow from './AddLineItemFlow';

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
  
  const handleAddCalculatorItem = (item: CalculatorItemCreate & { product_title: string; catalog_product_id: number }) => {
    // Transform the extended item back to the expected format
    const { product_title, catalog_product_id, ...calculatorItem } = item;
    onAddItem({
      ...calculatorItem,
      catalog_product_id: catalog_product_id,
      product_title: product_title
    });
  };

  return (
    <AddLineItemFlow
      mode="calculator"
      categories={categories}
      platforms={platforms}
      variantTypes={variantTypes}
      config={config}
      onAddCalculatorItem={handleAddCalculatorItem}
      onCancel={onCancel}
      defaultVariantMode="NEW"
    />
  );
};

export default AddCalculatorItemFlow;
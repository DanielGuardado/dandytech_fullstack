import React, { useState } from 'react';
import { 
  Category, 
  Platform, 
  VariantType, 
  Product,
  ProductVariant,
  CreateProductRequest,
  PriceChartingResult,
  POLineItemCreate 
} from '../types/api';
import { CalculatorConfig, CalculatorItemCreate } from '../types/calculator';
import { catalogService } from '../services/catalogService';
import { extractPlatformFromQuery, cleanTitle } from '../utils/platformExtractor';
import ProductSearch from './ProductSearch';
import CreateProductPanel from './CreateProductPanel';
import PriceChartingPanel from './PriceChartingPanel';
import VariantSelectPanel from './VariantSelectPanel';
import CalculatorPricingPanel from './CalculatorPricingPanel';

interface AllocationDetails {
  allocation_basis: number;
  cost_assignment_method: 'manual' | 'by_market_value';
  allocation_basis_source: string;
  quantity: number;
}

interface AddLineItemFlowProps {
  // Mode-agnostic props
  categories: Category[];
  platforms: Platform[];
  variantTypes: VariantType[];
  onCancel: () => void;
  defaultVariantMode?: string;
  
  // Mode selection
  mode?: 'purchase_order' | 'calculator';
  
  // Purchase Order mode props
  currentLineItems?: Array<{allocation_basis: number; quantity_expected: number; cost_assignment_method: string}>;
  onAddItem?: (item: POLineItemCreate & { product_title: string; variant_type_code: string; current_market_value?: number; platform_short_name?: string }, allocation: AllocationDetails) => void;
  
  // Calculator mode props
  config?: Record<string, CalculatorConfig>;
  onAddCalculatorItem?: (item: CalculatorItemCreate & { product_title: string; catalog_product_id: number }) => void;
}

type FlowStep = 'search' | 'create-product' | 'pc-link' | 'select-variant' | 'create-variant' | 'calculator-pricing';

const AddLineItemFlow: React.FC<AddLineItemFlowProps> = ({
  categories,
  platforms,
  variantTypes,
  onCancel,
  defaultVariantMode,
  mode = 'purchase_order',
  currentLineItems = [],
  onAddItem,
  config = {},
  onAddCalculatorItem
}) => {
  const [currentStep, setCurrentStep] = useState<FlowStep>('search');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flow state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Default variant mode for auto-highlighting when adding items (internal state)
  const [internalDefaultVariantMode, setInternalDefaultVariantMode] = useState<string>('NEW');
  
  // Platform mode for auto-appending platform to search queries (internal state)
  const [platformMode, setPlatformMode] = useState<number | null>(null);
  
  // Manual included mode for controlling manual checkbox behavior (internal state)
  const [manualIncludedMode, setManualIncludedMode] = useState<'default' | 'no_manual' | 'manual'>('default');
  
  // Set default variant mode when variantTypes loads
  React.useEffect(() => {
    if (variantTypes.length > 0 && internalDefaultVariantMode === 'NEW') {
      const firstActiveVariant = variantTypes.find(vt => vt.is_active);
      if (firstActiveVariant && firstActiveVariant.code !== 'NEW') {
        setInternalDefaultVariantMode(firstActiveVariant.code);
      }
    }
  }, [variantTypes, internalDefaultVariantMode]);
  
  // Get video game platforms for platform mode selector (find by category name "Video Game")
  const videoGamePlatforms = React.useMemo(() => {
    const videoGameCategory = categories.find(c => c.name === 'Video Game');
    if (!videoGameCategory) return [];
    
    // Filter platforms by Video Game category (platforms don't have is_active property)
    return platforms.filter(p => p.category_id === videoGameCategory.category_id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [platforms, categories]);
  
  // Get selected platform info for display
  const selectedPlatform = React.useMemo(() => {
    if (!platformMode) return null;
    return videoGamePlatforms.find(p => p.platform_id === platformMode);
  }, [platformMode, videoGamePlatforms]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newProductData, setNewProductData] = useState<CreateProductRequest | null>(null);
  const [createdProductId, setCreatedProductId] = useState<number | null>(null);
  const [priceChartingResults, setPriceChartingResults] = useState<PriceChartingResult[]>([]);
  const [availableVariants, setAvailableVariants] = useState<ProductVariant[]>([]);
  const [platformHintId, setPlatformHintId] = useState<number | null>(null);
  const [priceChartingTitle, setPriceChartingTitle] = useState<string | null>(null);
  
  // Calculator mode state
  const [selectedVariantForCalculator, setSelectedVariantForCalculator] = useState<ProductVariant | null>(null);

  const handleVariantSelected = (variant: ProductVariant, allocation: AllocationDetails | null) => {
    console.log('AddLineItemFlow - Variant selected:', {
      source: 'handleVariantSelected',
      mode: mode,
      variant: variant,
      allocation: allocation,
      selectedProduct: selectedProduct,
      createdProductId: createdProductId,
      newProductData: newProductData
    });
    
    // Determine product info - use selectedProduct if available, otherwise use created product data
    const productId = selectedProduct?.catalog_product_id || createdProductId;
    const productTitle = selectedProduct?.title || priceChartingTitle || newProductData?.title || 'Unknown Product';
    const platformShortName = selectedProduct?.platform?.short_name;
    
    if (!productId) {
      console.error('No product ID available for line item creation');
      return;
    }
    
    if (mode === 'calculator') {
      // Calculator mode: Store variant and go to pricing panel
      setSelectedVariantForCalculator(variant);
      setCurrentStep('calculator-pricing');
    } else {
      // Purchase Order mode: Create line item immediately
      if (!allocation || !onAddItem) {
        console.error('Purchase order mode requires allocation data and callback');
        return;
      }
      
      const lineItem: POLineItemCreate & { product_title: string; variant_type_code: string; current_market_value?: number; platform_short_name?: string } = {
        catalog_product_id: productId,
        variant_id: variant.variant_id,
        quantity_expected: allocation.quantity,
        product_title: productTitle,
        variant_type_code: variant.variant_type_code,
        current_market_value: variant.current_market_value || undefined,
        platform_short_name: platformShortName
      };

      const allocationData: AllocationDetails = {
        allocation_basis: allocation.allocation_basis,
        cost_assignment_method: allocation.cost_assignment_method,
        allocation_basis_source: allocation.allocation_basis_source,
        quantity: allocation.quantity
      };

      onAddItem(lineItem, allocationData);
      
      // Reset flow back to search for continuous item addition
      resetFlow();
    }
  };
  
  const handleCalculatorItemAdd = (itemData: CalculatorItemCreate) => {
    const productId = selectedProduct?.catalog_product_id || createdProductId;
    const productTitle = selectedProduct?.title || priceChartingTitle || newProductData?.title || 'Unknown Product';
    
    if (!productId || !onAddCalculatorItem) {
      console.error('Calculator item creation requires product ID and callback');
      return;
    }
    
    const calculatorItem = {
      ...itemData,
      catalog_product_id: productId,
      product_title: productTitle
    };
    
    onAddCalculatorItem(calculatorItem);
    
    // Reset flow back to search for continuous item addition
    resetFlow();
  };

  const resetFlow = () => {
    setCurrentStep('search');
    setSearchQuery('');
    setSelectedProduct(null);
    setNewProductData(null);
    setCreatedProductId(null);
    setPriceChartingResults([]);
    setAvailableVariants([]);
    setPlatformHintId(null);
    setPriceChartingTitle(null);
    setSelectedVariantForCalculator(null);
    setError(null);
  };


  const handleProductSelected = (product: Product) => {
    setSelectedProduct(product);
    setAvailableVariants(product.variants);
    
    if (product.variants.length === 0) {
      // No variants exist - need to create them
      const category = categories.find(c => c.category_id === product.category_id);
      
      if (category?.name === 'Video Game') {
        // Video game without variants - redirect to PriceCharting link
        setCreatedProductId(product.catalog_product_id);
        setNewProductData({
          title: product.title,
          category_id: product.category_id,
          brand: product.brand,
          upc: product.upc,
          game: product.platform ? { platform_id: product.platform.platform_id } : undefined
        } as CreateProductRequest);
        setCurrentStep('pc-link');
      } else {
        // Non-game without variants - go to manual variant creation
        setCreatedProductId(product.catalog_product_id);
        setCurrentStep('create-variant');
      }
    } else {
      // Has variants - normal flow
      setCurrentStep('select-variant');
    }
  };

  const handleCreateNewProduct = (query: string) => {
    // Extract platform information from the search query
    const { title, platformId } = extractPlatformFromQuery(query, platforms);
    
    // Use cleaned title and store platform hint
    setSearchQuery(cleanTitle(title));
    setPlatformHintId(platformId);
    setCurrentStep('create-product');
  };

  const handleProductCreated = async (productData: CreateProductRequest) => {
    setLoading(true);
    setError(null);

    try {
      const result = await catalogService.createProduct(productData);
      setCreatedProductId(result.catalog_product_id);
      setNewProductData(productData);

      // Check if this is a video game that should be linked to PriceCharting
      const category = categories.find(c => c.category_id === productData.category_id);
      if (category?.name === 'Video Game') {
        setCurrentStep('pc-link');
      } else {
        // For non-games, go straight to manual variant creation
        setCurrentStep('create-variant');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChartingSearch = async (query?: string, upc?: string) => {
    if (!createdProductId) return;

    setLoading(true);
    setError(null);

    try {
      // Get platform name from the created product data
      let platformName: string | undefined;
      if (newProductData?.game?.platform_id) {
        const platform = platforms.find(p => p.platform_id === newProductData.game?.platform_id);
        // Use full platform name for better PriceCharting results
        platformName = platform?.name || platform?.short_name;
      }

      const results = await catalogService.searchPriceCharting(createdProductId, query, upc, platformName);
      setPriceChartingResults(results.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search PriceCharting');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChartingLink = async (priceChartingId: string, selectedResult: PriceChartingResult) => {
    if (!createdProductId) return;

    setLoading(true);
    setError(null);

    // Store the PriceCharting title for immediate use
    setPriceChartingTitle(selectedResult.title);
    console.log('Stored PriceCharting title:', selectedResult.title);

    try {
      const result = await catalogService.linkToPriceCharting(createdProductId, priceChartingId);
      
      // Debug: Log the API response to understand its structure
      console.log('PriceCharting link API response:', result);
      
      // Transform LinkedVariant objects to full ProductVariant objects
      const transformedVariants: ProductVariant[] = (result.variants || []).map((linkedVariant: any) => {
        const variantType = variantTypes.find(vt => vt.code === linkedVariant.variant_type_code);
        return {
          variant_id: linkedVariant.variant_id,
          variant_type_id: variantType?.variant_type_id || 0,
          variant_type_code: linkedVariant.variant_type_code,
          display_name: variantType?.display_name || `${linkedVariant.variant_type_code} Variant`,
          current_market_value: linkedVariant.current_market_value,
          default_list_price: linkedVariant.current_market_value,
          platform_short: linkedVariant.platform_short,
          platform_manual_sensitive: linkedVariant.platform_manual_sensitive,
        };
      });
      setAvailableVariants(transformedVariants);
      setCurrentStep('select-variant');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link to PriceCharting');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPriceCharting = async () => {
    if (!createdProductId) return;

    setLoading(true);
    try {
      await catalogService.markNotOnPriceCharting(createdProductId);
      setCurrentStep('create-variant');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as not on PC');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVariant = async (variantTypeId: number, defaultListPrice?: number) => {
    if (!createdProductId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await catalogService.createVariant(createdProductId, variantTypeId, defaultListPrice);
      const variantType = variantTypes.find(vt => vt.variant_type_id === variantTypeId);
      
      const newVariant: ProductVariant = {
        variant_id: result.variant_id,
        variant_type_id: variantTypeId,
        variant_type_code: variantType?.code || 'UNKNOWN',
        display_name: variantType?.display_name || 'Unknown',
        current_market_value: defaultListPrice,
        default_list_price: defaultListPrice,
      };

      console.log('AddLineItemFlow - Created new variant:', {
        source: 'handleCreateVariant',
        apiResult: result,
        variantType: variantType,
        defaultListPrice: defaultListPrice,
        constructedVariant: newVariant
      });

      setAvailableVariants([newVariant]);
      setCurrentStep('select-variant');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create variant');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkToPriceCharting = () => {
    if (!selectedProduct) return;
    
    // Set up the state for PriceCharting linking
    setCreatedProductId(selectedProduct.catalog_product_id);
    setNewProductData({
      title: selectedProduct.title,
      category_id: selectedProduct.category_id,
      brand: selectedProduct.brand,
      upc: selectedProduct.upc,
      game: selectedProduct.platform ? { platform_id: selectedProduct.platform.platform_id } : undefined
    } as CreateProductRequest);
    setCurrentStep('pc-link');
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'create-product':
      case 'select-variant':
        setCurrentStep('search');
        break;
      case 'pc-link':
        setCurrentStep('create-product');
        break;
      case 'create-variant':
        setCurrentStep('pc-link');
        break;
      case 'calculator-pricing':
        setCurrentStep('select-variant');
        setSelectedVariantForCalculator(null);
        break;
    }
  };

  return (
    <div className="add-line-item-flow" style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: '#fff',
      border: 'none',
      borderRadius: '0',
      padding: '0',
      margin: '0'
    }}>
      <div className="flow-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '6px 12px',
        borderBottom: '1px solid #dee2e6',
        flexShrink: 0,
        minHeight: '32px'
      }}>
        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1d1d1f', margin: '0' }}>
          {mode === 'calculator' ? 'Add Calculator Item' : 'Add Line Item'}
        </h4>
        <div className="flow-actions" style={{ display: 'flex', gap: '8px' }}>
          {currentStep !== 'search' && (
            <button 
              className="back-button-small" 
              onClick={handleBack}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                border: '1px solid #6c757d',
                borderRadius: '3px',
                color: '#6c757d',
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              ← Back
            </button>
          )}
          <button 
            className="cancel-button" 
            onClick={onCancel}
            style={{
              padding: '4px 8px',
              background: '#dc3545',
              border: 'none',
              borderRadius: '3px',
              color: 'white',
              fontSize: '10px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="mode-selector-bar" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        padding: '8px 12px',
        background: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        fontSize: '10px',
        color: '#6c757d',
        flexShrink: 0,
        flexWrap: 'wrap',
        minHeight: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Variant default:</span>
          <select
            value={internalDefaultVariantMode}
            onChange={(e) => setInternalDefaultVariantMode(e.target.value)}
            style={{
              padding: '4px 6px',
              fontSize: '10px',
              border: '1px solid #6c757d',
              borderRadius: '3px',
              background: '#fff',
              color: '#6c757d',
              cursor: 'pointer',
              fontWeight: 'normal'
            }}
          >
            {variantTypes.filter(vt => vt.is_active).map((variantType) => (
              <option key={variantType.code} value={variantType.code}>
                {variantType.display_name}
              </option>
            ))}
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Platform mode:</span>
          <select
            value={platformMode || ''}
            onChange={(e) => setPlatformMode(e.target.value ? parseInt(e.target.value) : null)}
            style={{
              padding: '4px 6px',
              fontSize: '10px',
              border: '1px solid #6c757d',
              borderRadius: '3px',
              background: platformMode ? '#e3f2fd' : '#fff',
              color: platformMode ? '#1976d2' : '#6c757d',
              cursor: 'pointer',
              fontWeight: platformMode ? 'bold' : 'normal'
            }}
          >
            <option value="">None</option>
            {videoGamePlatforms.map((platform) => (
              <option key={platform.platform_id} value={platform.platform_id}>
                {platform.short_name || platform.name}
              </option>
            ))}
          </select>
          {selectedPlatform && (
            <span style={{ 
              fontSize: '9px', 
              color: '#1976d2', 
              fontStyle: 'italic' 
            }}>
              (Auto-appending "{selectedPlatform.short_name || selectedPlatform.name}" to searches)
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Manual included:</span>
          <select
            value={manualIncludedMode}
            onChange={(e) => setManualIncludedMode(e.target.value as 'default' | 'no_manual' | 'manual')}
            style={{
              padding: '4px 6px',
              fontSize: '10px',
              border: '1px solid #6c757d',
              borderRadius: '3px',
              background: manualIncludedMode !== 'default' ? '#fff5e6' : '#fff',
              color: manualIncludedMode !== 'default' ? '#ff6b00' : '#6c757d',
              cursor: 'pointer',
              fontWeight: manualIncludedMode !== 'default' ? 'bold' : 'normal'
            }}
          >
            <option value="default">Default</option>
            <option value="no_manual">No Manual</option>
            <option value="manual">Manual</option>
          </select>
          {manualIncludedMode !== 'default' && (
            <span style={{ 
              fontSize: '9px', 
              color: '#ff6b00', 
              fontStyle: 'italic' 
            }}>
              ({manualIncludedMode === 'manual' ? 'Always checked' : 'Always unchecked'})
            </span>
          )}
        </div>
      </div>

      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: '12px',
        maxHeight: 'calc(100vh - 120px)'
      }}>
        {error && (
          <div className="error-message" style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '8px 12px',
            borderRadius: '3px',
            border: '1px solid #f5c6cb',
            marginBottom: '12px',
            fontSize: '11px'
          }}>
            {error}
          </div>
        )}

        {currentStep === 'search' && (
          <ProductSearch
            onProductSelected={handleProductSelected}
            onCreateNew={handleCreateNewProduct}
            platformMode={selectedPlatform}
          />
        )}

        {currentStep === 'create-product' && (
        <CreateProductPanel
          categories={categories}
          platforms={platforms}
          initialQuery={searchQuery}
          onProductCreated={handleProductCreated}
          loading={loading}
          platformHintId={platformHintId}
        />
      )}

      {currentStep === 'pc-link' && (
        <PriceChartingPanel
          productTitle={newProductData?.title || ''}
          upc={newProductData?.upc}
          results={priceChartingResults}
          onSearch={handlePriceChartingSearch}
          onLink={handlePriceChartingLink}
          onSkip={handleSkipPriceCharting}
          loading={loading}
        />
      )}

      {currentStep === 'create-variant' && createdProductId && (
        <VariantSelectPanel
          variantTypes={variantTypes}
          availableVariants={[]}
          onVariantSelected={handleVariantSelected}
          onCreateVariant={handleCreateVariant}
          currentLineItems={currentLineItems}
          loading={loading}
          showCreateVariant={true}
          defaultVariantMode={internalDefaultVariantMode}
          mode={mode}
          onLinkToPriceCharting={handleLinkToPriceCharting}
          isLinkedToPriceCharting={false}
          isVideoGame={false}
        />
      )}

      {currentStep === 'select-variant' && availableVariants.length > 0 && (
        <VariantSelectPanel
          variantTypes={variantTypes}
          availableVariants={availableVariants}
          onVariantSelected={handleVariantSelected}
          onCreateVariant={handleCreateVariant}
          currentLineItems={currentLineItems}
          loading={loading}
          showCreateVariant={false}
          defaultVariantMode={internalDefaultVariantMode}
          mode={mode}
          onLinkToPriceCharting={handleLinkToPriceCharting}
          isLinkedToPriceCharting={!!selectedProduct?.pricecharting_id}
          isVideoGame={categories.find(c => c.category_id === selectedProduct?.category_id)?.name === 'Video Game'}
        />
      )}

      {currentStep === 'calculator-pricing' && selectedVariantForCalculator && (
        <CalculatorPricingPanel
          selectedVariant={selectedVariantForCalculator}
          productTitle={selectedProduct?.title || priceChartingTitle || newProductData?.title || 'Unknown Product'}
          platforms={platforms}
          config={config}
          onAddItem={handleCalculatorItemAdd}
          loading={loading}
          manualIncludedMode={manualIncludedMode}
        />
      )}

      </div>
    </div>
  );
};

export default AddLineItemFlow;
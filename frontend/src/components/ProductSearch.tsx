import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Product } from '../types/api';
import { catalogService } from '../services/catalogService';

interface ProductSearchProps {
  onProductSelected: (product: Product) => void;
  onCreateNew: (query: string) => void;
}

const ProductSearch: React.FC<ProductSearchProps> = ({
  onProductSelected,
  onCreateNew
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchProducts = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await catalogService.searchProducts(searchQuery);
      setResults(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchProducts(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, searchProducts]);

  // Auto-select first result when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % results.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev === 0 ? results.length - 1 : prev - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            onProductSelected(results[selectedIndex]);
          }
          break;
      }
    } else if (e.key === 'Enter' && query.trim() && !loading && !error) {
      // If Enter is pressed and there are no results (but there is a query), create new product
      handleCreateNew();
    }
  };

  const handleCreateNew = () => {
    onCreateNew(query);
  };

  return (
    <div className="product-search">
      <div className="search-input-container">
        <input
          type="text"
          placeholder="Search products or press Enter to create new..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="search-input"
          autoFocus
        />
        {loading && <div className="search-spinner">🔍</div>}
      </div>

      {error && (
        <div className="search-error">
          {error}
        </div>
      )}

      <div className="search-results">
        {query.trim() && !loading && results.length === 0 && !error && (
          <div className="no-results">
            <div className="no-results-message">
              No products found for "{query}"
            </div>
            <div className="no-results-hint">
              Press Enter or click below to create new product
            </div>
            <button 
              className="create-new-button"
              onClick={handleCreateNew}
            >
              + Create "{query}" as new product
            </button>
          </div>
        )}

        {results.length > 0 && (
          <div className="results-header">
            <span className="results-count">{results.length} products found</span>
            {query.trim() && (
              <button 
                className="create-new-link"
                onClick={handleCreateNew}
              >
                + Create "{query}" as new product
              </button>
            )}
          </div>
        )}

        {results.map((product, index) => (
          <div 
            key={product.catalog_product_id}
            className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => onProductSelected(product)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="product-info">
              <div className="product-title">{product.title}</div>
              <div className="product-details">
                <span className="product-category">{product.category_name}</span>
                {product.brand && <span className="product-brand">• {product.brand}</span>}
                {product.platform && (
                  <span className="product-platform">• {product.platform.short_name}</span>
                )}
                {product.upc && <span className="product-upc">• UPC: {product.upc}</span>}
              </div>
              <div className="product-variants">
                {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''} available
                {product.variants.length > 0 && (
                  <span className="variant-types">
                    {' '}({product.variants.map(v => v.variant_type_code).join(', ')})
                  </span>
                )}
              </div>
            </div>
            <div className="select-arrow">
              {index === selectedIndex ? '→' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductSearch;
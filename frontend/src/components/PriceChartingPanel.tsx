import React, { useState, useEffect, useRef } from 'react';
import { PriceChartingResult } from '../types/api';

interface PriceChartingPanelProps {
  productTitle: string;
  upc?: string;
  results: PriceChartingResult[];
  onSearch: (query?: string, upc?: string) => void;
  onLink: (priceChartingId: string) => void;
  onSkip: () => void;
  loading: boolean;
}

const PriceChartingPanel: React.FC<PriceChartingPanelProps> = ({
  productTitle,
  upc,
  results,
  onSearch,
  onLink,
  onSkip,
  loading
}) => {
  const [searchQuery, setSearchQuery] = useState(productTitle);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-search on mount if we have UPC or title
    if ((upc || productTitle) && !hasSearched) {
      handleSearch();
    }
  }, [upc, productTitle, hasSearched]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Add keyboard event listener for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasSearched || results.length === 0) return;

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
            onLink(results[selectedIndex].id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onSkip();
          break;
      }
    };

    // Add event listener to the document
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasSearched, results, selectedIndex, onLink, onSkip]);

  const handleSearch = () => {
    onSearch(searchQuery, upc);
    setHasSearched(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatPrice = (price?: number) => {
    return price ? `$${price.toFixed(2)}` : 'N/A';
  };

  return (
    <div className="pricecharting-panel">
      <div className="panel-header">
        <h4>Link to PriceCharting</h4>
        <div className="panel-subtitle">
          Find your product on PriceCharting to automatically create variants with market values
        </div>
      </div>

      <div className="pc-search-section">
        <div className="search-input-row">
          <input
            type="text"
            placeholder="Search PriceCharting..."
            value={searchQuery}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className="pc-search-input"
          />
          <button 
            onClick={handleSearch}
            className="pc-search-button"
            disabled={loading || !searchQuery.trim()}
          >
            {loading ? '🔍' : 'Search'}
          </button>
        </div>

        {upc && (
          <div className="upc-info">
            Will also search by UPC: {upc}
          </div>
        )}
      </div>

      {hasSearched && !loading && (
        <div className="pc-results">
          {results.length === 0 ? (
            <div className="no-pc-results">
              <div className="no-results-message">
                No matches found on PriceCharting
              </div>
              <div className="no-results-actions">
                <button onClick={handleSearch} className="retry-button">
                  Try Different Search
                </button>
                <button onClick={onSkip} className="skip-button">
                  Skip PriceCharting (Create Manual Variants)
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="results-header">
                <h5>PriceCharting Results</h5>
                <div className="results-subtitle">
                  Select the best match to automatically create variants
                </div>
              </div>

              <div className="pc-results-list" ref={resultListRef}>
                {results.map((result, index) => (
                  <div 
                    key={index}
                    className={`pc-result-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => onLink(result.id)}
                  >
                    <div className="pc-result-info">
                      <div className="pc-result-title">{result.title}</div>
                      <div className="pc-result-console">{result.platform}</div>
                      <div className="pc-result-id">ID: {result.id}</div>
                    </div>

                    <div className="select-arrow">
                      {index === selectedIndex ? '→' : ''}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pc-actions">
                <button onClick={onSkip} className="skip-link-button">
                  None of these match - Create Manual Variants
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {loading && (
        <div className="pc-loading">
          <div className="loading-spinner"></div>
          Searching PriceCharting...
        </div>
      )}
    </div>
  );
};

export default PriceChartingPanel;
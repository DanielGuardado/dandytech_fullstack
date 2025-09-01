import React, { useState, useEffect, useRef } from 'react';
import { PriceChartingResult } from '../types/api';

interface PriceChartingPanelProps {
  productTitle: string;
  upc?: string;
  results: PriceChartingResult[];
  onSearch: (query?: string, upc?: string) => void;
  onLink: (priceChartingId: string, selectedResult: PriceChartingResult) => void;
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
  const [isLinking, setIsLinking] = useState(false);
  const resultListRef = useRef<HTMLDivElement>(null);

  // Use refs to store callbacks to avoid effect re-runs
  const onLinkRef = useRef(onLink);
  const onSkipRef = useRef(onSkip);
  
  // Update refs when callbacks change
  useEffect(() => {
    onLinkRef.current = onLink;
    onSkipRef.current = onSkip;
  }, [onLink, onSkip]);

  useEffect(() => {
    // Auto-search on mount if we have UPC or title
    if ((upc || productTitle) && !hasSearched) {
      handleSearch();
    }
  }, [upc, productTitle, hasSearched]);

  // Store previous results to detect actual changes
  const prevResultsRef = useRef<PriceChartingResult[]>([]);
  
  // Only reset selected index when results actually change (not just reference)
  useEffect(() => {
    const resultsChanged = results.length !== prevResultsRef.current.length ||
      results.some((result, index) => result.id !== prevResultsRef.current[index]?.id);
    
    if (resultsChanged) {
      setSelectedIndex(0);
      prevResultsRef.current = results;
    }
  }, [results]);

  // Handle link with local loading protection
  const handleLink = async (priceChartingId: string, result: PriceChartingResult) => {
    if (isLinking || loading) return; // Prevent double-calls
    
    setIsLinking(true);
    try {
      await onLinkRef.current(priceChartingId, result);
    } finally {
      // Reset local state after a delay to ensure parent state has updated
      setTimeout(() => setIsLinking(false), 100);
    }
  };

  // Add keyboard event listener for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasSearched || results.length === 0 || loading || isLinking) return;

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
          setSelectedIndex(currentIndex => {
            if (results[currentIndex]) {
              handleLink(results[currentIndex].id, results[currentIndex]);
            }
            return currentIndex;
          });
          break;
        case 'Escape':
          e.preventDefault();
          onSkipRef.current();
          break;
      }
    };

    // Add event listener to the document
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasSearched, results.length, loading, isLinking]);

  const handleSearch = () => {
    onSearch(searchQuery, upc);
    setHasSearched(true);
    setSelectedIndex(0); // Reset selection when starting a new search
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
          {isLinking ? (
            <div className="pc-linking-state">
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  border: '3px solid #f3f3f3',
                  borderTop: '3px solid #007bff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '16px'
                }}></div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#495057',
                  marginBottom: '8px'
                }}>
                  Setting up variants...
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#6c757d'
                }}>
                  Creating product variants from PriceCharting data
                </div>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="no-pc-results">
              <div className="no-results-message">
                No matches found on PriceCharting
              </div>
              <div className="no-results-actions">
                <button onClick={handleSearch} className="retry-button">
                  Try Different Search
                </button>
                <button onClick={onSkip} className="skip-button" disabled={loading}>
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
                    onClick={() => handleLink(result.id, result)}
                    style={{ cursor: 'pointer' }}
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
                <button onClick={onSkip} className="skip-link-button" disabled={loading}>
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

// Add CSS keyframes for spinner animation
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
if (!document.head.querySelector('style[data-spinner]')) {
  spinnerStyle.setAttribute('data-spinner', 'true');
  document.head.appendChild(spinnerStyle);
}

export default PriceChartingPanel;
import React, { useState, useEffect } from 'react';
import { calculatorService } from '../services/calculatorService';
import { CalculatorSession } from '../types/calculator';
import { Source } from '../types/api';

interface CalculatorSessionSelectorProps {
  currentSessionId?: number | null;
  onSessionSelect: (session: CalculatorSession | null) => void;
  sources: Source[];
}

interface SessionWithSourceName extends CalculatorSession {
  source_name?: string;
}

const CalculatorSessionSelector: React.FC<CalculatorSessionSelectorProps> = ({ 
  currentSessionId, 
  onSessionSelect, 
  sources 
}) => {
  const [sessions, setSessions] = useState<SessionWithSourceName[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await calculatorService.listSessions({
        limit: 50 // Get recent sessions
      });
      
      // Enrich sessions with source names
      const sessionsWithSourceNames = response.items.map(session => {
        const source = sources.find(s => s.source_id === session.source_id);
        return {
          ...session,
          source_name: source ? `${source.name} (${source.code})` : session.source_id ? `Source ${session.source_id}` : undefined
        };
      });
      
      setSessions(sessionsWithSourceNames);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleSessionSelect = (session: SessionWithSourceName | null) => {
    onSessionSelect(session);
    setIsOpen(false);
  };

  const currentSession = sessions.find(session => session.session_id === currentSessionId);

  const formatSessionDisplay = (session: SessionWithSourceName) => {
    const date = new Date(session.created_at).toLocaleDateString();
    const time = new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${session.session_name || 'Unnamed'} - ${session.source_name || 'No Source'} - ${date} ${time}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'converted_to_po': return '#dc3545';
      case 'finalized': return '#28a745';
      default: return '#007bff';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'converted_to_po': return 'Converted';
      case 'finalized': return 'Finalized';
      default: return 'Draft';
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          padding: '8px 12px',
          background: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          minHeight: '32px'
        }}
      >
        <div style={{ flex: 1 }}>
          {currentSession ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong>{currentSession.session_name || 'Unnamed Session'}</strong>
                <div style={{
                  background: getStatusColor(currentSession.status),
                  color: 'white',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  fontSize: '8px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase'
                }}>
                  {getStatusLabel(currentSession.status)}
                </div>
              </div>
              <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '2px' }}>
                {currentSession.source_name} - {new Date(currentSession.created_at).toLocaleDateString()} - {currentSession.total_items} items
                {currentSession.expected_profit_margin && (
                  <span> - {currentSession.expected_profit_margin.toFixed(1)}% profit</span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: '#6c757d' }}>
              {loading ? 'Loading...' : 'Select or Create Calculator Session'}
            </div>
          )}
        </div>
        <div style={{
          fontSize: '14px',
          color: '#6c757d',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>
          ▼
        </div>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 1000,
          background: '#fff',
          border: '1px solid #dee2e6',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          maxHeight: '300px',
          overflowY: 'auto',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {/* Create New Session Option */}
          <div
            onClick={() => handleSessionSelect(null)}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderBottom: '1px solid #e9ecef',
              background: '#f8f9fa',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#007bff'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e3f2fd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f8f9fa';
            }}
          >
            + Create New Session
          </div>

          {/* Error Display */}
          {error && (
            <div style={{
              padding: '8px 12px',
              color: '#dc3545',
              fontSize: '11px',
              borderBottom: '1px solid #e9ecef'
            }}>
              {error}
            </div>
          )}

          {/* Loading Display */}
          {loading && (
            <div style={{
              padding: '8px 12px',
              color: '#6c757d',
              fontSize: '11px'
            }}>
              Loading sessions...
            </div>
          )}

          {/* Sessions List */}
          {!loading && sessions.length === 0 && !error && (
            <div style={{
              padding: '8px 12px',
              color: '#6c757d',
              fontSize: '11px'
            }}>
              No calculator sessions found
            </div>
          )}

          {sessions.map(session => (
            <div
              key={session.session_id}
              onClick={() => handleSessionSelect(session)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #e9ecef',
                fontSize: '11px',
                background: session.session_id === currentSessionId ? '#e3f2fd' : '#fff'
              }}
              onMouseEnter={(e) => {
                if (session.session_id !== currentSessionId) {
                  e.currentTarget.style.background = '#f8f9fa';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = session.session_id === currentSessionId ? '#e3f2fd' : '#fff';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong>{session.session_name || 'Unnamed Session'}</strong>
                    <div style={{
                      background: getStatusColor(session.status),
                      color: 'white',
                      padding: '1px 3px',
                      borderRadius: '2px',
                      fontSize: '7px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {getStatusLabel(session.status)}
                    </div>
                  </div>
                  <div style={{ color: '#6c757d', fontSize: '10px', marginTop: '2px' }}>
                    {formatSessionDisplay(session)}
                  </div>
                </div>
                <div style={{ color: '#6c757d', fontSize: '10px', textAlign: 'right' }}>
                  <div>{session.total_items} items</div>
                  {session.expected_profit_margin && (
                    <div style={{ 
                      color: calculatorService.getProfitMarginColor(session.expected_profit_margin),
                      fontWeight: 'bold'
                    }}>
                      {session.expected_profit_margin.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Refresh Sessions Option */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              loadSessions();
            }}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '10px',
              color: '#6c757d',
              textAlign: 'center',
              background: '#f8f9fa',
              borderTop: '1px solid #e9ecef'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e9ecef';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f8f9fa';
            }}
          >
            🔄 Refresh Sessions
          </div>
        </div>
      )}
    </div>
  );
};

export default CalculatorSessionSelector;
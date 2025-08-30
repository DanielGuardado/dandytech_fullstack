import React, { useState } from 'react';
import { 
  Platform
} from '../types/api';
import {
  CalculatorConfig
} from '../types/calculator';

interface CalculatorConfigPanelProps {
  config: Record<string, CalculatorConfig>;
  platforms: Platform[];
  onUpdateConfig: (updates: Record<string, number>) => Promise<void>;
  onUpdatePlatformMarkup: (platformId: number, markup: number) => Promise<void>;
}

const CalculatorConfigPanel: React.FC<CalculatorConfigPanelProps> = ({
  config,
  platforms,
  onUpdateConfig,
  onUpdatePlatformMarkup
}) => {
  const [loading, setLoading] = useState(false);
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [editingPlatform, setEditingPlatform] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const handleConfigEdit = (key: string, value: number) => {
    setEditValues({ ...editValues, [key]: value.toString() });
    setEditingConfig(key);
  };

  const handleConfigSave = async (key: string) => {
    const value = parseFloat(editValues[key]);
    if (isNaN(value) || value < 0) return;
    
    setLoading(true);
    try {
      await onUpdateConfig({ [key]: value });
      setEditingConfig(null);
      setEditValues({});
    } catch (err) {
      // Error handling would be done by parent component
    } finally {
      setLoading(false);
    }
  };

  const handlePlatformEdit = (platformId: number, markup: number) => {
    setEditValues({ ...editValues, [`platform_${platformId}`]: markup.toString() });
    setEditingPlatform(platformId);
  };

  const handlePlatformSave = async (platformId: number) => {
    const value = parseFloat(editValues[`platform_${platformId}`]);
    if (isNaN(value) || value < 0) return;
    
    setLoading(true);
    try {
      await onUpdatePlatformMarkup(platformId, value);
      setEditingPlatform(null);
      setEditValues({});
    } catch (err) {
      // Error handling would be done by parent component
    } finally {
      setLoading(false);
    }
  };

  const formatConfigValue = (config: CalculatorConfig): string => {
    if (config.config_type === 'percentage') {
      return `${config.config_value}%`;
    } else {
      return `$${config.config_value.toFixed(2)}`;
    }
  };

  return (
    <div style={{ 
      border: '1px solid #dee2e6',
      borderRadius: '4px',
      background: '#f8f9fa',
      padding: '8px',
      marginTop: '8px'
    }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#495057' }}>
        Calculator Configuration
      </h4>
      
      {/* Fee Configuration */}
      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase' }}>
          Fees & Costs
        </h5>
        <div style={{ display: 'grid', gap: '6px' }}>
          {Object.entries(config)
            .filter(([key]) => key !== 'default_markup')
            .map(([key, configItem]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: '#fff', borderRadius: '3px', border: '1px solid #e9ecef' }}>
              <span style={{ fontSize: '11px', color: '#495057', flex: 1 }}>
                {configItem.description || key.replace(/_/g, ' ')}
              </span>
              
              {editingConfig === key ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    value={editValues[key] || configItem.config_value.toString()}
                    onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
                    disabled={loading}
                    style={{
                      width: '60px',
                      padding: '2px 4px',
                      border: '1px solid #dee2e6',
                      borderRadius: '2px',
                      fontSize: '10px',
                      textAlign: 'right',
                      fontFamily: 'monospace'
                    }}
                    step={configItem.config_type === 'percentage' ? '0.01' : '0.01'}
                    min="0"
                  />
                  <button
                    onClick={() => handleConfigSave(key)}
                    disabled={loading}
                    style={{
                      background: '#28a745',
                      color: 'white',
                      padding: '1px 4px',
                      borderRadius: '2px',
                      fontSize: '8px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setEditingConfig(null);
                      setEditValues({});
                    }}
                    disabled={loading}
                    style={{
                      background: '#6c757d',
                      color: 'white',
                      padding: '1px 4px',
                      borderRadius: '2px',
                      fontSize: '8px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', color: '#007bff' }}>
                    {formatConfigValue(configItem)}
                  </span>
                  <button
                    onClick={() => handleConfigEdit(key, configItem.config_value)}
                    disabled={loading || editingConfig !== null || editingPlatform !== null}
                    style={{
                      background: '#007bff',
                      color: 'white',
                      padding: '1px 4px',
                      borderRadius: '2px',
                      fontSize: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: loading || editingConfig !== null || editingPlatform !== null ? 0.5 : 1
                    }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Platform Markups */}
      <div>
        <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase' }}>
          Platform Markups
        </h5>
        <div style={{ display: 'grid', gap: '4px', maxHeight: '200px', overflow: 'auto' }}>
          {platforms
            .filter(platform => platform.category_id === 2) // Video Game platforms
            .map(platform => (
            <div key={platform.platform_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px', background: '#fff', borderRadius: '2px', border: '1px solid #e9ecef' }}>
              <span style={{ fontSize: '10px', color: '#495057', flex: 1 }}>
                {platform.short_name || platform.name}
              </span>
              
              {editingPlatform === platform.platform_id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <input
                    type="number"
                    value={editValues[`platform_${platform.platform_id}`] || platform.default_markup?.toString() || '3.50'}
                    onChange={(e) => setEditValues({ ...editValues, [`platform_${platform.platform_id}`]: e.target.value })}
                    disabled={loading}
                    style={{
                      width: '50px',
                      padding: '1px 3px',
                      border: '1px solid #dee2e6',
                      borderRadius: '2px',
                      fontSize: '9px',
                      textAlign: 'right',
                      fontFamily: 'monospace'
                    }}
                    step="0.25"
                    min="0"
                  />
                  <button
                    onClick={() => handlePlatformSave(platform.platform_id)}
                    disabled={loading}
                    style={{
                      background: '#28a745',
                      color: 'white',
                      padding: '1px 3px',
                      borderRadius: '1px',
                      fontSize: '7px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setEditingPlatform(null);
                      setEditValues({});
                    }}
                    disabled={loading}
                    style={{
                      background: '#6c757d',
                      color: 'white',
                      padding: '1px 3px',
                      borderRadius: '1px',
                      fontSize: '7px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 'bold', color: '#28a745' }}>
                    ${(platform.default_markup || 3.50).toFixed(2)}
                  </span>
                  <button
                    onClick={() => handlePlatformEdit(platform.platform_id, platform.default_markup || 3.50)}
                    disabled={loading || editingConfig !== null || editingPlatform !== null}
                    style={{
                      background: '#007bff',
                      color: 'white',
                      padding: '1px 3px',
                      borderRadius: '1px',
                      fontSize: '7px',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: loading || editingConfig !== null || editingPlatform !== null ? 0.5 : 1
                    }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalculatorConfigPanel;
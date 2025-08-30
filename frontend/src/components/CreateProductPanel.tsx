import React, { useState, useEffect } from 'react';
import { Category, Platform, CreateProductRequest } from '../types/api';

interface CreateProductPanelProps {
  categories: Category[];
  platforms: Platform[];
  initialQuery: string;
  onProductCreated: (productData: CreateProductRequest) => void;
  loading: boolean;
}

const CreateProductPanel: React.FC<CreateProductPanelProps> = ({
  categories,
  platforms,
  initialQuery,
  onProductCreated,
  loading
}) => {
  const [formData, setFormData] = useState<CreateProductRequest>({
    category_id: 0,
    title: initialQuery,
    brand: '',
    upc: '',
    release_year: undefined,
    game: undefined,
    console: undefined,
  });

  const [availablePlatforms, setAvailablePlatforms] = useState<Platform[]>([]);

  useEffect(() => {
    // Auto-select Video Game category if available
    const videoGameCategory = categories.find(c => c.name === 'Video Game');
    if (videoGameCategory && formData.category_id === 0) {
      setFormData(prev => ({ ...prev, category_id: videoGameCategory.category_id }));
    }
  }, [categories, formData.category_id]);

  useEffect(() => {
    // Filter platforms based on selected category
    const selectedCategory = categories.find(c => c.category_id === formData.category_id);
    if (selectedCategory) {
      const categoryPlatforms = platforms.filter(p => p.category_id === selectedCategory.category_id);
      setAvailablePlatforms(categoryPlatforms);
      
      // Auto-select first platform if only one available or clear if category changed
      if (categoryPlatforms.length === 1) {
        setFormData(prev => ({
          ...prev,
          game: { platform_id: categoryPlatforms[0].platform_id }
        }));
      } else if (categoryPlatforms.length === 0) {
        setFormData(prev => ({
          ...prev,
          game: undefined,
          console: undefined
        }));
      }
    }
  }, [formData.category_id, categories, platforms]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (name === 'platform_id') {
      setFormData(prev => ({
        ...prev,
        game: { platform_id: parseInt(value) }
      }));
    } else if (name === 'model_number') {
      setFormData(prev => ({
        ...prev,
        console: {
          ...prev.console,
          model_number: value
        }
      }));
    } else if (name === 'storage_capacity_gb') {
      setFormData(prev => ({
        ...prev,
        console: {
          ...prev.console,
          model_number: prev.console?.model_number || '',
          storage_capacity_gb: value ? parseInt(value) : undefined
        }
      }));
    } else if (name === 'firmware_sensitive') {
      setFormData(prev => ({
        ...prev,
        console: {
          ...prev.console,
          model_number: prev.console?.model_number || '',
          firmware_sensitive: (e.target as HTMLInputElement).checked
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? (value ? parseInt(value) : undefined) : value,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clean up title (titleize)
    const titleizedTitle = formData.title
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const cleanedData: CreateProductRequest = {
      ...formData,
      title: titleizedTitle,
      brand: formData.brand?.trim() || undefined,
      upc: formData.upc?.trim() || undefined,
    };

    onProductCreated(cleanedData);
  };

  const selectedCategory = categories.find(c => c.category_id === formData.category_id);
  const isVideoGame = selectedCategory?.name === 'Video Game';
  const isConsole = selectedCategory?.name === 'Console';

  const canSubmit = formData.category_id > 0 && 
    formData.title.trim() && 
    (!isVideoGame || formData.game?.platform_id) &&
    (!isConsole || formData.console?.model_number);

  return (
    <div className="create-product-panel">
      <div className="panel-header">
        <h4>Create New Product</h4>
        <div className="panel-subtitle">
          Creating: "{initialQuery}"
        </div>
      </div>

      <form onSubmit={handleSubmit} className="create-product-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category_id">Category *</label>
            <select
              id="category_id"
              name="category_id"
              value={formData.category_id}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Category</option>
              {categories.map(category => (
                <option key={category.category_id} value={category.category_id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        {isVideoGame && availablePlatforms.length > 0 && (
          <div className="form-group">
            <label htmlFor="platform_id">Platform *</label>
            <select
              id="platform_id"
              name="platform_id"
              value={formData.game?.platform_id || ''}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Platform</option>
              {availablePlatforms.map(platform => (
                <option key={platform.platform_id} value={platform.platform_id}>
                  {platform.name} ({platform.short_name})
                </option>
              ))}
            </select>
          </div>
        )}

        {isConsole && (
          <div className="console-fields">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="model_number">Model Number *</label>
                <input
                  type="text"
                  id="model_number"
                  name="model_number"
                  value={formData.console?.model_number || ''}
                  onChange={handleInputChange}
                  placeholder="e.g., CECH-2501A"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="storage_capacity_gb">Storage (GB)</label>
                <input
                  type="number"
                  id="storage_capacity_gb"
                  name="storage_capacity_gb"
                  value={formData.console?.storage_capacity_gb || ''}
                  onChange={handleInputChange}
                  placeholder="e.g., 120"
                />
              </div>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="firmware_sensitive"
                  checked={formData.console?.firmware_sensitive || false}
                  onChange={handleInputChange}
                />
                Firmware Sensitive
              </label>
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="brand">Brand</label>
            <input
              type="text"
              id="brand"
              name="brand"
              value={formData.brand}
              onChange={handleInputChange}
              placeholder="e.g., Sony, Nintendo"
            />
          </div>

          <div className="form-group">
            <label htmlFor="upc">UPC</label>
            <input
              type="text"
              id="upc"
              name="upc"
              value={formData.upc}
              onChange={handleInputChange}
              placeholder="12-digit barcode"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="release_year">Release Year</label>
          <input
            type="number"
            id="release_year"
            name="release_year"
            value={formData.release_year || ''}
            onChange={handleInputChange}
            placeholder="e.g., 2011"
            min="1970"
            max={new Date().getFullYear()}
          />
        </div>

        <button
          type="submit"
          className="create-product-submit"
          disabled={!canSubmit || loading}
        >
          {loading && <span className="loading-spinner"></span>}
          {loading ? 'Creating Product...' : 'Create Product'}
        </button>
      </form>
    </div>
  );
};

export default CreateProductPanel;
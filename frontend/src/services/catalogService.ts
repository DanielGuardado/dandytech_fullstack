import {
  CatalogSearchResponse,
  CreateProductRequest,
  CreateProductResponse,
  PriceChartingSearchResponse,
  POLineItemCreate,
  POLineItem,
} from '../types/api';

const API_BASE_URL = '/api/v1';

class CatalogService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // Search catalog products
  async searchProducts(query: string, platform?: string): Promise<CatalogSearchResponse> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (platform) params.append('platform', platform);
    
    return this.request<CatalogSearchResponse>(`/catalog/search?${params}`);
  }

  // Create a new product
  async createProduct(data: CreateProductRequest): Promise<CreateProductResponse> {
    return this.request<CreateProductResponse>('/catalog/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Search PriceCharting for a product
  async searchPriceCharting(productId: number, query?: string, upc?: string): Promise<PriceChartingSearchResponse> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (upc) params.append('upc', upc);
    
    return this.request<PriceChartingSearchResponse>(
      `/catalog/${productId}/pricecharting/search?${params}`
    );
  }

  // Link product to PriceCharting (creates variants automatically)
  async linkToPriceCharting(productId: number, priceChartingId: string): Promise<any> {
    return this.request(`/catalog/${productId}/pricecharting/link`, {
      method: 'POST',
      body: JSON.stringify({ pricecharting_id: priceChartingId }),
    });
  }

  // Mark product as not on PriceCharting
  async markNotOnPriceCharting(productId: number): Promise<any> {
    return this.request(`/catalog/${productId}/pricecharting/not-on-pc`, {
      method: 'POST',
    });
  }

  // Create custom variant for products not on PriceCharting
  async createVariant(productId: number, variantTypeId: number, defaultListPrice?: number): Promise<any> {
    return this.request(`/catalog/products/${productId}/variants`, {
      method: 'POST',
      body: JSON.stringify({
        variant_type_id: variantTypeId,
        default_list_price: defaultListPrice,
      }),
    });
  }

  // Add line item to purchase order
  async addLineItem(poId: number, data: POLineItemCreate): Promise<POLineItem> {
    return this.request<POLineItem>(`/purchase-orders/${poId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Lock purchase order
  async lockPurchaseOrder(poId: number): Promise<any> {
    return this.request(`/purchase-orders/${poId}/lock`, {
      method: 'POST',
    });
  }
}

export const catalogService = new CatalogService();
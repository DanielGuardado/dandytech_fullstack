import { 
  POCreate, POResponse, PODetail, POListResponse, POUpdate, POLineItemUpdate, Source, PaymentMethod, LookupsResponse,
  StagingTemplateResponse, ReceivingCommitRequest, ReceivingCommitResponse,
  InventoryItem, InventoryListResponse, InventoryUpdateRequest, InventoryAttributesUpdateRequest,
  InventoryAdjustmentRequest, InventoryAdjustmentResponse
} from '../types/api';

const API_BASE_URL = '/api/v1';

class ApiService {
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

    // Handle 204 No Content responses (e.g., from DELETE endpoints)
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async createPurchaseOrder(data: POCreate): Promise<POResponse> {
    return this.request<POResponse>('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLookups(): Promise<LookupsResponse> {
    return this.request<LookupsResponse>('/lookups');
  }

  async getSources(): Promise<Source[]> {
    const lookups = await this.getLookups();
    return lookups.sources;
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const lookups = await this.getLookups();
    return lookups.payment_methods;
  }

  async getPurchaseOrder(poId: number): Promise<PODetail> {
    return this.request<PODetail>(`/purchase-orders/${poId}`);
  }

  async getPurchaseOrders(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    source_id?: number;
    is_locked?: boolean;
  }): Promise<POListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.status) searchParams.append('status', params.status);
    if (params?.source_id) searchParams.append('source_id', params.source_id.toString());
    if (params?.is_locked !== undefined) searchParams.append('is_locked', params.is_locked.toString());
    
    const queryString = searchParams.toString();
    const endpoint = queryString ? `/purchase-orders?${queryString}` : '/purchase-orders';
    
    return this.request<POListResponse>(endpoint);
  }

  // Receiving methods
  async getStagingTemplate(poId: number, includeNonReceivable: boolean = false): Promise<StagingTemplateResponse> {
    const params = new URLSearchParams();
    params.append('po_id', poId.toString());
    if (includeNonReceivable) {
      params.append('include_non_receivable', 'true');
    }
    return this.request<StagingTemplateResponse>(`/receiving/staging-template?${params}`);
  }

  async commitReceiving(data: ReceivingCommitRequest): Promise<ReceivingCommitResponse> {
    return this.request<ReceivingCommitResponse>('/receiving/commit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLockedPurchaseOrders(params?: {
    limit?: number;
    offset?: number;
  }): Promise<POListResponse> {
    const searchParams = new URLSearchParams();
    searchParams.append('is_locked', 'true'); // Use 'true' instead of '1' for boolean
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    
    const queryString = searchParams.toString();
    return this.request<POListResponse>(`/purchase-orders?${queryString}`);
  }

  async updatePurchaseOrder(poId: number, data: POUpdate): Promise<PODetail> {
    return this.request<PODetail>(`/purchase-orders/${poId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updatePurchaseOrderLineItem(poId: number, itemId: number, data: POLineItemUpdate): Promise<any> {
    return this.request(`/purchase-orders/${poId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePurchaseOrderLineItem(poId: number, itemId: number): Promise<void> {
    return this.request(`/purchase-orders/${poId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  // Inventory methods
  async getInventoryItems(params?: {
    po_id?: number;
    status?: string;
    category_id?: number;
    include_profiles?: boolean;
    sort?: string;
    page?: number;
    page_size?: number;
    limit?: number;
    offset?: number;
  }): Promise<InventoryListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.po_id) searchParams.append('po_id', params.po_id.toString());
    if (params?.status) searchParams.append('status', params.status);
    if (params?.category_id) searchParams.append('category_id', params.category_id.toString());
    if (params?.include_profiles) searchParams.append('include_profiles', 'full');
    if (params?.sort) searchParams.append('sort', params.sort);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    
    const queryString = searchParams.toString();
    const endpoint = queryString ? `/inventory/items?${queryString}` : '/inventory/items';
    
    return this.request<InventoryListResponse>(endpoint);
  }

  async getInventoryItem(itemId: number, includeProfile: boolean = true): Promise<InventoryItem> {
    const params = new URLSearchParams();
    if (includeProfile) params.append('include_profile', 'true');
    
    const queryString = params.toString();
    const endpoint = queryString ? `/inventory/items/${itemId}?${queryString}` : `/inventory/items/${itemId}`;
    
    return this.request<InventoryItem>(endpoint);
  }

  async updateInventoryItem(itemId: number, data: InventoryUpdateRequest): Promise<InventoryItem> {
    return this.request<InventoryItem>(`/inventory/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateInventoryItemAttributes(itemId: number, data: InventoryAttributesUpdateRequest): Promise<{
    inventory_item_id: number;
    updated_at: string;
    unit_attributes_json: Record<string, any>;
    profile_id?: number;
    profile_version?: number;
  }> {
    return this.request(`/inventory/items/${itemId}/attributes`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async adjustInventoryItem(itemId: number, data: InventoryAdjustmentRequest): Promise<InventoryAdjustmentResponse> {
    return this.request<InventoryAdjustmentResponse>(`/inventory/items/${itemId}/adjust`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiService = new ApiService();
import {
  CalculatorConfig,
  CalculatorConfigUpdate,
  PlatformMarkupUpdate,
  CalculatorSession,
  CalculatorSessionDetail,
  CalculatorSessionCreate,
  CalculatorSessionUpdate,
  CalculatorSessionListResponse,
  CalculatorItem,
  CalculatorItemCreate,
  CalculatorItemUpdate,
  ConvertToPORequest,
  ConvertToPOResponse
} from '../types/calculator';

const API_BASE_URL = '/api/v1';

class CalculatorService {
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

  // -------- Configuration Methods --------

  async getConfig(): Promise<Record<string, CalculatorConfig>> {
    return this.request<Record<string, CalculatorConfig>>('/calculator/config');
  }

  async updateConfig(updates: Record<string, number>): Promise<Record<string, CalculatorConfig>> {
    return this.request<Record<string, CalculatorConfig>>('/calculator/config', {
      method: 'PUT',
      body: JSON.stringify({ configs: updates }),
    });
  }

  async updatePlatformMarkup(platformId: number, markup: number): Promise<any> {
    return this.request<any>(`/platforms/${platformId}/markup`, {
      method: 'PUT',
      body: JSON.stringify({ default_markup: markup }),
    });
  }

  // -------- Session Management --------

  async createSession(data: CalculatorSessionCreate): Promise<CalculatorSession> {
    return this.request<CalculatorSession>('/calculator/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listSessions(params?: {
    limit?: number;
    offset?: number;
    status?: 'draft' | 'finalized' | 'converted_to_po';
  }): Promise<CalculatorSessionListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.status) searchParams.append('status', params.status);

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/calculator/sessions?${queryString}` : '/calculator/sessions';
    
    return this.request<CalculatorSessionListResponse>(endpoint);
  }

  async getSession(sessionId: number): Promise<CalculatorSessionDetail> {
    return this.request<CalculatorSessionDetail>(`/calculator/sessions/${sessionId}`);
  }

  async updateSession(sessionId: number, updates: CalculatorSessionUpdate): Promise<CalculatorSession> {
    return this.request<CalculatorSession>(`/calculator/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSession(sessionId: number): Promise<void> {
    return this.request<void>(`/calculator/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  // -------- Item Management --------

  async addItem(sessionId: number, itemData: CalculatorItemCreate): Promise<CalculatorItem> {
    return this.request<CalculatorItem>(`/calculator/sessions/${sessionId}/items`, {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  }

  async updateItem(sessionId: number, itemId: number, updates: CalculatorItemUpdate): Promise<CalculatorItem> {
    return this.request<CalculatorItem>(`/calculator/sessions/${sessionId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteItem(sessionId: number, itemId: number): Promise<void> {
    return this.request<void>(`/calculator/sessions/${sessionId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  // -------- Calculation Operations --------

  async recalculateSession(sessionId: number): Promise<CalculatorSessionDetail> {
    return this.request<CalculatorSessionDetail>(`/calculator/sessions/${sessionId}/recalculate`, {
      method: 'POST',
    });
  }

  // -------- Purchase Order Conversion --------

  async convertToPurchaseOrder(sessionId: number, poData: ConvertToPORequest): Promise<ConvertToPOResponse> {
    return this.request<ConvertToPOResponse>(`/calculator/sessions/${sessionId}/convert-to-po`, {
      method: 'POST',
      body: JSON.stringify(poData),
    });
  }

  // -------- Utility Methods --------

  /**
   * Calculate profit margin percentage from pricing data (profit/revenue)
   */
  calculateProfitMargin(salePrice: number, purchasePrice: number, fees: number): number {
    const netAfterFees = salePrice - fees;
    const profit = netAfterFees - purchasePrice;
    return netAfterFees > 0 ? (profit / netAfterFees) * 100 : 0;
  }

  /**
   * Calculate profit margin percentage using backend net value (preferred)
   */
  calculateProfitMarginFromNet(netAfterFees: number, purchasePrice: number): number {
    const profit = netAfterFees - purchasePrice;
    return netAfterFees > 0 ? (profit / netAfterFees) * 100 : 0;
  }

  /**
   * Calculate ROI percentage from pricing data (profit/cost)
   */
  calculateROI(salePrice: number, purchasePrice: number, fees: number): number {
    const netAfterFees = salePrice - fees;
    const profit = netAfterFees - purchasePrice;
    return purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;
  }

  /**
   * Calculate ROI percentage using backend net value (preferred)
   */
  calculateROIFromNet(netAfterFees: number, purchasePrice: number): number {
    const profit = netAfterFees - purchasePrice;
    return purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;
  }

  /**
   * Calculate total profit from an item
   */
  calculateProfit(salePrice: number, purchasePrice: number, fees: number, quantity: number = 1): number {
    const netAfterFees = salePrice - fees;
    const profitPerItem = netAfterFees - purchasePrice;
    return profitPerItem * quantity;
  }

  /**
   * Format currency values for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  /**
   * Format percentage values for display
   */
  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  /**
   * Determine profit margin color coding
   */
  getProfitMarginColor(margin: number, targetMargin: number = 25): string {
    if (margin >= targetMargin) return '#28a745'; // Green - good margin
    if (margin >= targetMargin * 0.8) return '#ffc107'; // Yellow - ok margin
    return '#dc3545'; // Red - low margin
  }

  /**
   * Check if session can be converted to PO
   */
  canConvertToPO(session: CalculatorSession): boolean {
    return session.status !== 'converted_to_po' && session.total_items > 0;
  }

  /**
   * Generate session name if not provided
   */
  generateSessionName(sourceName?: string): string {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return sourceName ? `${sourceName} - ${date} ${time}` : `Session - ${date} ${time}`;
  }

  /**
   * Calculate average percentage of market value across items
   */
  calculateAveragePercentOfMarket(items: CalculatorItem[]): number {
    const validItems = items.filter(item => 
      item.market_price && item.market_price > 0 && item.calculated_purchase_price && item.calculated_purchase_price > 0
    );
    
    if (validItems.length === 0) return 0;
    
    const percentages = validItems.map(item => {
      const marketPrice = item.market_price || 0;
      const purchasePrice = item.calculated_purchase_price || 0;
      return (purchasePrice / marketPrice) * 100;
    });
    
    const totalPercent = percentages.reduce((sum, percent) => sum + percent, 0);
    return totalPercent / percentages.length;
  }

  /**
   * Calculate average ROI across items
   */
  calculateAverageROI(items: CalculatorItem[]): number {
    const validItems = items.filter(item => 
      item.net_after_fees && item.calculated_purchase_price && item.calculated_purchase_price > 0
    );
    
    if (validItems.length === 0) return 0;
    
    const rois = validItems.map(item => 
      this.calculateROIFromNet(item.net_after_fees || 0, item.calculated_purchase_price || 0)
    );
    
    const totalROI = rois.reduce((sum, roi) => sum + roi, 0);
    return totalROI / rois.length;
  }

  /**
   * Calculate session totals from items array (for dynamic updates)
   */
  calculateSessionTotals(items: CalculatorItem[]): {
    total_items: number;
    total_market_value: number;
    total_estimated_revenue: number;
    total_purchase_price: number;
    expected_profit: number;
    expected_profit_margin: number;
    average_percent_of_market: number;
    average_roi: number;
  } {
    const total_items = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const total_market_value = items.reduce((sum, item) => 
      sum + ((item.market_price || item.final_base_price || 0) * (item.quantity || 1)), 0
    );
    const total_estimated_revenue = items.reduce((sum, item) => 
      sum + ((item.net_after_fees || 0) * (item.quantity || 1)), 0
    );
    const total_purchase_price = items.reduce((sum, item) => 
      sum + ((item.calculated_purchase_price || 0) * (item.quantity || 1)), 0
    );
    const expected_profit = total_estimated_revenue - total_purchase_price;
    const expected_profit_margin = total_estimated_revenue > 0 
      ? (expected_profit / total_estimated_revenue) * 100 
      : 0;

    const average_percent_of_market = this.calculateAveragePercentOfMarket(items);
    const average_roi = this.calculateAverageROI(items);

    return {
      total_items,
      total_market_value,
      total_estimated_revenue,
      total_purchase_price,
      expected_profit,
      expected_profit_margin,
      average_percent_of_market,
      average_roi
    };
  }
}

export const calculatorService = new CalculatorService();
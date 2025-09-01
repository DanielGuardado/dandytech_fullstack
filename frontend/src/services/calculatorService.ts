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
    const result = await this.request<CalculatorSessionDetail>(`/calculator/sessions/${sessionId}`);
    console.log(`API GET_SESSION response for session ${sessionId}:`, {
      cashback_enabled: result.cashback_enabled,
      tax_exempt: result.tax_exempt,
      session_id: result.session_id
    });
    return result;
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
  getProfitMarginColor(margin: number): string {
    if (margin > 20) return '#28a745'; // Green - good margin (>20%)
    if (margin >= 15) return '#ffc107'; // Yellow - acceptable margin (15-20%)
    return '#dc3545'; // Red - low margin (<15%)
  }

  /**
   * Determine ROI color coding
   */
  getROIColor(roi: number): string {
    if (roi >= 40) return '#28a745'; // Green - excellent ROI (≥40%)
    if (roi >= 25) return '#ffc107'; // Yellow - good ROI (25-40%)
    return '#dc3545'; // Red - poor ROI (<25%)
  }

  /**
   * Determine % of market color coding
   */
  getPercentOfMarketColor(percent: number): string {
    if (percent > 55) return '#28a745'; // Green - good purchase price (>55%)
    if (percent >= 50) return '#ffc107'; // Yellow - caution zone (50-55%)
    return '#dc3545'; // Red - too low, quality concern? (<50%)
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
   * Compare asking price vs calculated purchase price
   */
  compareAskingPrice(askingPrice: number, calculatedPrice: number): {
    difference: number;
    percentageDifference: number;
    isDealGood: boolean;
    description: string;
  } {
    const difference = askingPrice - calculatedPrice;
    const percentageDifference = calculatedPrice > 0 ? (difference / calculatedPrice) * 100 : 0;
    const isDealGood = askingPrice <= calculatedPrice;
    
    let description: string;
    if (Math.abs(difference) < 0.01) {
      description = "Asking price matches calculated max";
    } else if (isDealGood) {
      description = `Save ${this.formatCurrency(Math.abs(difference))} vs calculated max`;
    } else {
      description = `${this.formatCurrency(difference)} over calculated max`;
    }
    
    return {
      difference,
      percentageDifference,
      isDealGood,
      description
    };
  }

  /**
   * Calculate actual profit margin if buying at asking price
   */
  calculateActualMargin(askingPrice: number, netAfterFees: number): number {
    const actualProfit = netAfterFees - askingPrice;
    return netAfterFees > 0 ? (actualProfit / netAfterFees) * 100 : 0;
  }

  /**
   * Calculate actual ROI if buying at asking price
   */
  calculateActualROI(askingPrice: number, netAfterFees: number): number {
    const actualProfit = netAfterFees - askingPrice;
    return askingPrice > 0 ? (actualProfit / askingPrice) * 100 : 0;
  }

  /**
   * Get color coding for asking price comparison
   */
  getAskingPriceColor(askingPrice: number, calculatedPrice: number): string {
    const comparison = this.compareAskingPrice(askingPrice, calculatedPrice);
    if (comparison.isDealGood) {
      return '#28a745'; // Green - good deal
    } else if (comparison.percentageDifference <= 10) {
      return '#ffc107'; // Yellow - slightly over but acceptable
    } else {
      return '#dc3545'; // Red - significantly over
    }
  }

  /**
   * Calculate profit if buying at asking price
   */
  calculateProfitAtAskingPrice(totalRevenue: number, askingPrice: number): number {
    return totalRevenue - askingPrice;
  }

  /**
   * Calculate profit margin if buying at asking price
   */
  calculateMarginAtAskingPrice(totalRevenue: number, askingPrice: number): number {
    const profit = this.calculateProfitAtAskingPrice(totalRevenue, askingPrice);
    return totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  }

  /**
   * Calculate ROI if buying at asking price
   */
  calculateROIAtAskingPrice(totalRevenue: number, askingPrice: number): number {
    const profit = this.calculateProfitAtAskingPrice(totalRevenue, askingPrice);
    return askingPrice > 0 ? (profit / askingPrice) * 100 : 0;
  }

  /**
   * Get deal quality rating based on asking price vs max purchase
   */
  getDealQualityRating(askingPrice: number, maxPurchasePrice: number): {
    rating: string;
    emoji: string;
    color: string;
    percentage: number;
  } {
    if (maxPurchasePrice <= 0) {
      return { rating: 'No Data', emoji: '❓', color: '#6c757d', percentage: 0 };
    }

    const percentage = (askingPrice / maxPurchasePrice) * 100;

    if (percentage < 80) {
      return { rating: 'Excellent', emoji: '🟢', color: '#28a745', percentage };
    } else if (percentage < 95) {
      return { rating: 'Good Deal', emoji: '🟡', color: '#28a745', percentage };
    } else if (percentage <= 100) {
      return { rating: 'Fair Deal', emoji: '🟠', color: '#ffc107', percentage };
    } else {
      return { rating: 'Overpriced', emoji: '🔴', color: '#dc3545', percentage };
    }
  }

  /**
   * Calculate percentage of market value for asking price
   */
  calculatePercentOfMarketForAskingPrice(askingPrice: number, totalMarketValue: number): number {
    return totalMarketValue > 0 ? (askingPrice / totalMarketValue) * 100 : 0;
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
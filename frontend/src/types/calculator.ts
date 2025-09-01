export interface CalculatorConfig {
  config_key: string;
  config_value: number;
  config_type: 'percentage' | 'amount';
  description?: string;
  updated_at?: string;
}

export interface CalculatorConfigUpdate {
  configs: Record<string, number>;
}

export interface PlatformMarkupUpdate {
  default_markup: number;
}

// Session types
export interface CalculatorSession {
  session_id: number;
  session_name?: string;
  source_id?: number;
  total_items: number;
  total_market_value?: number;
  total_estimated_revenue?: number;
  total_purchase_price?: number;
  expected_profit?: number;
  expected_profit_margin?: number;
  status: 'draft' | 'finalized' | 'converted_to_po';
  purchase_order_id?: number;
  asking_price?: number;
  cashback_enabled: boolean;
  tax_exempt: boolean;
  created_at: string;
  updated_at: string;
  source_name?: string;
}

export interface CalculatorSessionDetail extends CalculatorSession {
  items: CalculatorItem[];
}

export interface CalculatorSessionCreate {
  session_name?: string;
  source_id?: number;
  asking_price?: number;
}

export interface CalculatorSessionUpdate {
  session_name?: string;
  source_id?: number;
  status?: 'draft' | 'finalized' | 'converted_to_po';
  asking_price?: number;
  cashback_enabled?: boolean;
  tax_exempt?: boolean;
}

export interface CalculatorSessionListResponse {
  items: CalculatorSession[];
  total: number;
  limit?: number;
  offset?: number;
}

// Item types
export interface CalculatorItem {
  item_id: number;
  session_id: number;
  catalog_product_id?: number;
  variant_id?: number;
  product_title?: string;
  variant_type_code?: string;
  pricecharting_id?: string;
  
  // Pricing inputs
  market_price?: number;
  override_price?: number;
  final_base_price?: number;
  cost_source?: 'pricecharting' | 'manual' | 'pricecharting_override';
  markup_amount?: number;
  deductions?: number;
  deduction_reasons?: string;  // JSON string from backend
  has_manual?: boolean;
  
  // Calculated values
  estimated_sale_price?: number;
  total_fees?: number;
  net_after_fees?: number;
  target_profit_percentage: number;
  calculated_purchase_price?: number;
  
  // Detailed calculation breakdown (not stored, calculated on-demand)
  sales_tax?: number;
  final_value?: number;
  base_variable_fee?: number;
  discounted_variable_fee?: number;
  transaction_fee?: number;
  ad_fee?: number;
  shipping_cost?: number;
  supplies_cost?: number;
  regular_cashback?: number;
  shipping_cashback?: number;
  total_cashback?: number;
  purchase_price_before_tax?: number;
  purchase_sales_tax?: number;
  
  quantity: number;
  notes?: string;
  created_at: string;
  
  
  // Display fields
  platform_name?: string;
  platform_short_name?: string;
}

export interface CalculatorItemCreate {
  catalog_product_id?: number;
  variant_id?: number;
  product_title?: string;
  variant_type_code?: string;
  pricecharting_id?: string;
  market_price?: number;
  override_price?: number;
  markup_amount?: number;
  deductions?: number;
  deduction_reasons?: Record<string, number>;
  has_manual?: boolean;
  shipping_cost: number;
  target_profit_percentage?: number;
  quantity?: number;
  notes?: string;
}

export interface CalculatorItemUpdate {
  override_price?: number;
  markup_amount?: number;
  deductions?: number;
  deduction_reasons?: Record<string, number>;
  has_manual?: boolean;
  shipping_cost?: number;
  target_profit_percentage?: number;
  quantity?: number;
  notes?: string;
}

// Calculation types
export interface ItemCalculationRequest {
  base_price: number;
  markup_amount: number;
  target_profit_percentage: number;
  category_name: string;
  quantity: number;
}

export interface ItemCalculationResponse {
  estimated_sale_price: number;
  total_fees: number;
  net_after_fees: number;
  calculated_purchase_price: number;
  profit_per_item: number;
  profit_margin_percentage: number;
}

export interface SessionCalculationSummary {
  total_items: number;
  total_quantity: number;
  total_market_value: number;
  total_estimated_revenue: number;
  total_purchase_price: number;
  total_fees: number;
  expected_profit: number;
  expected_profit_margin: number;
}

// Conversion types
export interface ConvertToPORequest {
  po_date_purchased?: string;
  external_order_number?: string;
  notes?: string;
}

export interface ConvertToPOResponse {
  purchase_order_id: number;
  po_number: string;
  items_converted: number;
  session_id: number;
}
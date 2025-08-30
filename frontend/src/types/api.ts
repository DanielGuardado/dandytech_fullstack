export interface POCreate {
  source_id: number;
  date_purchased?: string;
  payment_method_id?: number;
  external_order_number?: string;
  subtotal: number;
  tax: number;
  shipping: number;
  fees: number;
  discounts: number;
  notes?: string;
}

export interface POResponse {
  purchase_order_id: number;
  po_number: string;
  status: string;
  is_locked: boolean;
  total_cost: number;
  lines: any[];
}

export interface Source {
  source_id: number;
  code: string;
  name: string;
  type: string;
  is_active: boolean;
}

export interface PaymentMethod {
  payment_method_id: number;
  code: string;
  display_name: string;
  is_active: boolean;
}

export interface LookupsResponse {
  sources: Source[];
  payment_methods: PaymentMethod[];
  categories: Category[];
  variant_types: VariantType[];
  condition_grades: ConditionGrade[];
  platforms: Platform[];
}

export interface Category {
  category_id: number;
  name: string;
  is_active: boolean;
}

export interface Platform {
  platform_id: number;
  name: string;
  short_name: string;
  category_id: number;
  is_active: boolean;
}

export interface VariantType {
  variant_type_id: number;
  code: string;
  display_name: string;
  is_active: boolean;
}

export interface ConditionGrade {
  condition_grade_id: number;
  code: string;
  display_name: string;
  description?: string;
  rank: number;
  is_active: boolean;
}

// Catalog Types
export interface Product {
  catalog_product_id: number;
  title: string;
  category_id: number;
  category_name: string;
  brand?: string;
  upc?: string;
  platform?: {
    platform_id: number;
    name: string;
    short_name: string;
  };
  variants: ProductVariant[];
}

export interface ProductVariant {
  variant_id: number;
  variant_type_id: number;
  variant_type_code: string;
  display_name: string;
  current_market_value?: number;
  default_list_price?: number;
}

export interface CatalogSearchResponse {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateProductRequest {
  category_id: number;
  title: string;
  brand?: string;
  upc?: string;
  release_year?: number;
  attributes_json?: any;
  game?: {
    platform_id: number;
  };
  console?: {
    model_number: string;
    storage_capacity_gb?: number;
    firmware_sensitive?: boolean;
  };
}

export interface CreateProductResponse {
  catalog_product_id: number;
  category_id: number;
  title: string;
  upc?: string;
  created_children: string[];
}

export interface PriceChartingResult {
  id: string;
  title: string;
  platform: string;
}

export interface PriceChartingSearchResponse {
  results: PriceChartingResult[];
}

export interface POLineItemCreate {
  variant_id: number;
  catalog_product_id: number;
  quantity_expected: number;
  allocation_basis?: number;
  allocation_basis_source?: string;
  cost_assignment_method?: string;
  allocated_unit_cost?: number;
  notes?: string;
}

export interface POLineItem {
  purchase_order_item_id: number;
  purchase_order_id: number;
  variant_id: number;
  catalog_product_id: number;
  quantity_expected: number;
  quantity_received: number;
  allocation_basis: number;
  allocation_basis_source: string;
  cost_assignment_method: string;
  allocated_unit_cost?: number;
  receive_status: string;
  updated_at?: string;
  notes?: string;
  product_title?: string;
  variant_type_code?: string;
  variant_display_name?: string;
}

export interface PORow {
  purchase_order_id: number;
  po_number: string;
  source_id: number;
  status: string;
  is_locked: boolean;
  subtotal: number;
  tax: number;
  shipping: number;
  fees: number;
  discounts: number;
  total_cost: number;
  created_at: string;
}

export interface POListResponse {
  items: PORow[];
  total: number;
  limit: number;
  offset: number;
}

export interface PODetail {
  purchase_order_id: number;
  po_number: string;
  source_id: number;
  status: string;
  is_locked: boolean;
  subtotal: number;
  tax: number;
  shipping: number;
  fees: number;
  discounts: number;
  total_cost: number;
  date_purchased?: string;
  payment_method_id?: number;
  external_order_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  lines: POLineItem[];
}

export interface POUpdate {
  date_purchased?: string;
  payment_method_id?: number;
  external_order_number?: string;
  subtotal?: number;
  tax?: number;
  shipping?: number;
  fees?: number;
  discounts?: number;
  notes?: string;
}

export interface POLineItemUpdate {
  quantity_expected?: number;
  allocation_basis?: number;
  allocation_basis_source?: string;
  cost_assignment_method?: string;
  allocated_unit_cost?: number;
  notes?: string;
}

// Receiving Types
export interface StagingItem {
  purchase_order_item_id: number;
  variant_id: number;
  catalog_product_id: number;
  quantity_expected: number;
  quantity_received: number;
  remaining: number;
  receive_status: string;
  allocated_unit_cost?: number;
  allocation_basis: number;
  allocation_basis_source: string;
  current_market_value?: number;
  product_title: string;
  category_name: string;
  platform_short?: string;
  variant_type_code: string;
  updated_at: string;
  sku_parts: any;
  receivable: boolean;
}

export interface StagingTemplateResponse {
  purchase_order_id: number;
  po_number: string;
  status: string;
  is_locked: boolean;
  counts: any;
  items: StagingItem[];
}

export interface ReceivingCommitItem {
  purchase_order_item_id: number;
  qty_to_receive: number;
  damaged: boolean;
  short: boolean;
  updated_at: string;
}

export interface ReceivingCommitRequest {
  purchase_order_id: number;
  items: ReceivingCommitItem[];
}

export interface ReceivingCommitResponse {
  inventory_item_ids: number[];
  po_progress: any;
}

export interface ReceivingItem extends StagingItem {
  qty_to_receive: number;
  damaged: boolean;
  short: boolean;
  isModified: boolean;
}

// Inventory Types
export interface InventoryItem {
  inventory_item_id: number;
  purchase_order_item_id: number;
  purchase_order_id: number;
  po_number: string;
  seller_sku?: string;
  quantity: number;
  available: number;
  status: 'Pending' | 'Active' | 'Damaged' | 'Archived';
  allocated_unit_cost?: number;
  list_price?: number;
  condition_grade_id?: number;
  condition_grade_code?: string;
  title_suffix?: string;
  location?: string;
  unit_attributes_json?: Record<string, any> | string; // Can be string or parsed object
  catalog_product_id: number;
  category_id: number;
  product_title: string;
  category_name?: string;
  platform_short?: string;
  product_brand?: string;
  product_upc?: string;
  variant_id: number;
  variant_type_id: number;
  variant_type_code: string;
  variant_current_market_value?: number;
  variant_default_list_price?: number;
  profile_id?: number;
  profile_version?: number;
  profile_matched_on?: string;
  created_at: string;
  updated_at: string;
}

export interface AttributeField {
  key_name: string;
  data_type: 'bool' | 'text' | 'string' | 'int' | 'decimal';
  is_required: boolean;
  enum_values?: string[] | null;
  regex?: string | null;
  min_value?: number | null;
  max_value?: number | null;
  display_label?: string | null;
  display_help?: string | null;
  display_group?: string | null;
  display_order?: number | null;
}

export interface AttributeProfile {
  profile_id: number;
  name: string;
  version: number;
  fields: AttributeField[];
}

export interface InventoryListResponse {
  items: InventoryItem[];
  total: number;
  limit: number;
  offset: number;
  profiles?: Record<string, AttributeProfile>;
}

export interface InventoryUpdateRequest {
  seller_sku?: string;
  list_price?: number;
  condition_grade_id?: number;
  title_suffix?: string;
  location?: string;
}

export interface InventoryAttributesUpdateRequest {
  unit_attributes_json: Record<string, any>;
}

export interface InventoryAdjustmentRequest {
  delta: number;
  reason: 'cycle_count' | 'damage' | 'loss' | 'correction' | 'found';
  set_status?: 'Pending' | 'Active' | 'Damaged' | 'Archived';
  notes?: string;
  auto_archive_when_zero?: boolean;
}

export interface InventoryAdjustmentResponse {
  inventory_item_id: number;
  updated_at: string;
  quantity: number;
  status: string;
  available: number;
}
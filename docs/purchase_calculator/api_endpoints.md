# Purchase Calculator API Endpoints

[← Back to Purchase Calculator Documentation](./README.md)

## Calculator Session Management

### GET `/api/v1/calculator/sessions`
**Purpose**: List all calculator sessions with pagination  
**Query Parameters**:
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response**:
```json
{
  "items": [
    {
      "session_id": 13,
      "session_name": "Gaming Lot - August 2025",
      "asking_price": 150.00,
      "total_items": 5,
      "total_estimated_revenue": 425.80,
      "expected_profit_margin": 0.45,
      "status": "draft",
      "created_at": "2025-08-31T10:30:00Z"
    }
  ],
  "total": 25,
  "limit": 50,
  "offset": 0
}
```

### POST `/api/v1/calculator/sessions`
**Purpose**: Create new calculator session  
**Payload**:
```json
{
  "session_name": "New Gaming Lot",
  "asking_price": 100.00
}
```

### GET `/api/v1/calculator/sessions/{session_id}`
**Purpose**: Get session details with all line items  
**Response**:
```json
{
  "session_id": 13,
  "session_name": "Gaming Lot - August 2025",
  "asking_price": 150.00,
  "status": "draft",
  "items": [
    {
      "item_id": 45,
      "catalog_product_id": 114,
      "variant_id": 263,
      "product_title": "Spider-Man: Shattered Dimensions",
      "variant_type_code": "CIB",
      "estimated_sale_price": 86.34,
      "purchase_price": 25.90,
      "quantity": 1,
      "deductions": 15.00,
      "deduction_reasons": "Missing manual",
      "has_manual": false
    }
  ],
  "totals": {
    "total_items": 5,
    "total_estimated_revenue": 425.80,
    "total_purchase_cost": 235.50,
    "expected_profit_margin": 0.447
  }
}
```

### PUT `/api/v1/calculator/sessions/{session_id}`
**Purpose**: Update session metadata  
**Payload**:
```json
{
  "session_name": "Updated Session Name",
  "asking_price": 175.00
}
```

## Calculator Line Items

### POST `/api/v1/calculator/sessions/{session_id}/items`
**Purpose**: Add item to calculator session  
**Payload**:
```json
{
  "catalog_product_id": 114,
  "variant_id": 263,
  "estimated_sale_price": 86.34,
  "purchase_price": 25.90,
  "quantity": 1,
  "custom_deductions": 0,
  "deductions": 15.00,
  "deduction_reasons": "Missing manual",
  "has_manual": false,
  "notes": "Good condition overall"
}
```

### PUT `/api/v1/calculator/sessions/{session_id}/items/{item_id}`
**Purpose**: Update existing line item  
**Payload**: Same as POST but updates existing item

### DELETE `/api/v1/calculator/sessions/{session_id}/items/{item_id}`
**Purpose**: Remove item from session

## Catalog Integration

### GET `/api/v1/catalog/search`
**Purpose**: Search catalog products for calculator  
**Query Parameters**:
- `q`: Search query
- `platform` (optional): Platform filter
- `limit` (optional): Results limit
- `offset` (optional): Pagination offset

**Response**:
```json
{
  "items": [
    {
      "catalog_product_id": 114,
      "title": "Spider-Man: Shattered Dimensions",
      "category_name": "Video Game",
      "brand": "Sony",
      "platform": {
        "platform_id": 3,
        "name": "PlayStation 3",
        "short_name": "PS3"
      },
      "variants": [
        {
          "variant_id": 263,
          "variant_type_code": "CIB",
          "display_name": "Complete in Box",
          "current_market_value": 86.34,
          "default_list_price": null,
          "platform_short": "PS3",
          "platform_manual_sensitive": true
        }
      ]
    }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0
}
```

## Configuration & Lookups

### GET `/api/v1/calculator/config`
**Purpose**: Get calculator configuration (fees, margins, etc.)  
**Response**:
```json
{
  "ebay_final_value_fee": 0.1295,
  "ebay_managed_payments_fee": 0.029,
  "sales_tax_rate": 0.08,
  "shipping_cost_fixed": 5.50,
  "supplies_cost_per_item": 1.25,
  "target_profit_margin": 0.40,
  "cashback_rates": {
    "regular": 0.02,
    "shipping": 0.05
  }
}
```

### GET `/api/v1/lookups`
**Purpose**: Get reference data for dropdowns  
**Response**:
```json
{
  "categories": [
    {"category_id": 1, "name": "Video Game"},
    {"category_id": 2, "name": "Console"}
  ],
  "platforms": [
    {"platform_id": 3, "name": "PlayStation 3", "short_name": "PS3"},
    {"platform_id": 5, "name": "PlayStation 5", "short_name": "PS5"}
  ],
  "variant_types": [
    {"variant_type_id": 4, "code": "CIB", "display_name": "Complete in Box"},
    {"variant_type_id": 2, "code": "LOOSE", "display_name": "Loose"}
  ]
}
```

## Response Patterns

### Success Response Structure
All successful responses follow this pattern:
- **Single Item**: Direct object or primitive
- **List Responses**: `{items: [], total: number, limit?: number, offset?: number}`
- **Creation**: Returns created object with generated ID
- **Updates**: Returns updated object
- **Deletions**: Returns success confirmation

### Error Response Structure
```json
{
  "detail": "Session not found",
  "error_code": "SESSION_NOT_FOUND",
  "status_code": 404
}
```

### Common HTTP Status Codes
- **200**: Successful GET/PUT operations
- **201**: Successful POST (creation)
- **204**: Successful DELETE
- **400**: Invalid request data
- **404**: Resource not found
- **409**: Conflict (duplicate data)
- **500**: Internal server error

## Authentication & Headers
Currently no authentication required for development. All requests should include:
```
Content-Type: application/json
Accept: application/json
```

## Rate Limiting
No rate limiting currently implemented in development environment.
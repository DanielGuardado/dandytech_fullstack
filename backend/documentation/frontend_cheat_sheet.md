# Frontend Cheat Sheet — PO → Receiving → Inventory (MVP)

> One-pager for the keyboard-first grid. Includes the **exact calls**, key fields, and expected shapes. Copy/paste friendly.

---

## 0) Status & Concepts

* **PO statuses:** `open` → `locked` (after allocation).  *(PO completion will come later)*
* **Inventory statuses:** `Pending` (not sellable), `Active` (sellable), `Damaged`, `Archived`.
* **Dynamic attributes:** resolved by **entity=inventory\_item + category**. Use `include_profiles=full` to avoid per-row lookups.

---

## 1) Create a Purchase Order

**POST** `/purchase-orders`

```json
{ "vendor_id": 12, "po_number": "PO-2025-001" }
```

**Returns**: `{ purchase_order_id, ... }`

---

## 2) Catalog: find or create products

**GET** `/catalog/search?q=portal%202&platform=PS3`

If not found:
**POST** `/catalog/products`

```json
{ "category_id": 1, "title": "Portal 2", "brand": "Valve", "upc": "123456789012" }
```

**(Games/Consoles)** *(optional)* Link PriceCharting to auto-create variants:

* **GET** `/catalog/{id}/pricecharting/search?upc=...` *(or `?q=...`)*
* **POST** `/catalog/{id}/pricecharting/link` *(or `/not-on-pc`)*

Custom variant (optional):
**POST** `/catalog/products/{id}/variants`

---

## 3) Add PO lines

**POST** `/purchase-orders/{po_id}/items`

```json
{
  "catalog_product_id": 321,
  "variant_id": 555,
  "quantity_ordered": 3,
  "allocation_basis": 59.99,                
  "allocation_basis_source": "pricecharting",
  "cost_assignment_method": "by_market_value"   
}
```

---

## 4) Lock PO (allocate costs)

**POST** `/purchase-orders/{po_id}/lock`

* Validates costs and executes allocation proc.
* Sets `is_locked=true` on the PO.

---

## 5) Receiving

### 5a) Staging template

**GET** `/receiving/staging-template?po_id={po_id}`

* Returns rows with `purchase_order_item_id`, `variant_id`, `catalog_product_id`, `remaining`, product/variant context, and **SKU preview**.

### 5b) Commit receive

**POST** `/receiving/commit`

```json
{
  "purchase_order_id": 42,
  "items": [
    {
      "purchase_order_item_id": 101,
      "qty_to_receive": 2,
      "damaged": false,
      "short": false,
      "seq3": 1,
      "updated_at": "2025-08-27T00:00:00Z"
    }
  ]
}
```

**Effects**: creates `InventoryItems` cohorts, updates PO line `quantity_received/receive_status`.
**Returns**: `{ inventory_item_ids:[...], po_progress:{...} }`.

---

## 6) Inventory grid (with dynamic attributes)

**GET** `/inventory/items?po_id={po_id}&include_profiles=full&sort=-updated_at&page=1&page_size=50`

**items\[] includes** (trim):

* IDs: `inventory_item_id`, `purchase_order_item_id`, `purchase_order_id`, `po_number`
* Sellable context: `status`, `quantity`, `available` (derived), `allocated_unit_cost`, `list_price`
* Editables: `seller_sku`, `condition_grade_id`, `title_suffix`, `location`, `unit_attributes_json`
* Product: `catalog_product_id`, `category_id`, `product_title`, `brand`, `upc`, `platform_short`
* Variant: `variant_id`, `variant_type_id`, `variant_type_code`, `current_market_value`, `default_list_price`
* **Profile hints**: `profile_id`, `profile_version`, `profile_matched_on`
* Timestamps: `created_at`, `updated_at`

**profiles** map (when `include_profiles=full`):

```json
{
  "7": {
    "profile_id": 7,
    "name": "InventoryItem:VideoGame",
    "version": 1,
    "fields": [
      {"key_name":"inserts","data_type":"bool","is_required":true},
      {"key_name":"tested","data_type":"bool","is_required":true},
      {"key_name":"disc_details","data_type":"text","is_required":true},
      {"key_name":"case_condition","data_type":"text","is_required":true},
      {"key_name":"cartridge_condition","data_type":"text","is_required":true},
      {"key_name":"art_condition","data_type":"text","is_required":true},
      {"key_name":"notes","data_type":"text","is_required":false},
      {"key_name":"defects","data_type":"text","is_required":false}
    ]
  }
}
```

**UI binding**: render row attributes from `profiles[String(item.profile_id)].fields`.

---

## 7) Row detail (side panel)

**GET** `/inventory/items/{inventory_item_id}?include_profile=true`

* Returns a single row with the same fields as list + the resolved attribute profile inline.

---

## 8) Inline edits (on blur)

### 8a) Core columns

**PATCH** `/inventory/items/{id}`

```json
{ "list_price": 24.99 }
```

Allowed fields: `seller_sku`, `list_price`, `condition_grade_id`, `title_suffix`, `location`.

* Strings trimmed; empty → `null`.
* `condition_grade_id` validated to exist.
* Returns **updated detail** row.

### 8b) Attributes JSON (profile-driven)

**PUT** `/inventory/items/{id}/attributes`

```json
{
  "unit_attributes_json": {
    "inserts": true,
    "tested": true,
    "disc_details": "Light scuffs; plays fine",
    "case_condition": "Good",
    "cartridge_condition": null,
    "art_condition": "Very Good",
    "notes": "Includes manual"
  }
}
```

* Validates required fields + types from the resolved profile (entity=inventory\_item, category-based).
* Returns `inventory_item_id`, `updated_at`, `unit_attributes_json`, `profile_id`, `profile_version`.

---

## 9) Adjust quantity / status (loss, damage, cycle count)

**POST** `/inventory/items/{id}/adjust`

```json
{
  "delta": -1,                 
  "reason": "damage",         
  "set_status": "Damaged",    
  "notes": "Cracked case",
  "auto_archive_when_zero": true
}
```

* `delta` can be **0** for status-only transitions.
* Reasons enum: `cycle_count | damage | loss | correction | found`.
* Auto-archives when quantity hits 0 and no explicit `set_status` supplied.
* Writes an `InventoryEvents` row (audit) and returns **updated detail**.

---

## 10) Extras you may call (rare)

* **GET** `/attributes/profiles/resolve?inventory_item_id={id}` → resolve fields for one item.
* **GET** `/attributes/profiles/resolve?entity=inventory_item&category_id={id}` → resolve by context (e.g., pre-create).

---

## Error handling (UI hints)

* **400**: validation failures (e.g., missing required attribute field) → show inline field errors.
* **404**: resource not found.
* **409**: *not used currently* (no optimistic concurrency yet for edits/adjust).

---

## Performance tips

* Always use `include_profiles=full` on list pages; dedupe profile definitions per page.
* Cache profiles by `profile_id:version` if you navigate without reload.
* Use `page_size` 50–100; sort by `-updated_at` for most recent edits on top.

---

## Quick smoke set (copy/paste)

```bash
# 1) List inventory for a PO with profiles embedded
curl "http://127.0.0.1:8000/inventory/items?po_id=42&include_profiles=full&page=1&page_size=50"

# 2) Update price on blur
curl -X PATCH "http://127.0.0.1:8000/inventory/items/1011" \
  -H "Content-Type: application/json" \
  -d '{"list_price": 24.99}'

# 3) Save attributes (profile-validated)
curl -X PUT "http://127.0.0.1:8000/inventory/items/1011/attributes" \
  -H "Content-Type: application/json" \
  -d '{"unit_attributes_json": {"tested": true, "disc_details": "Light scuffs"}}'

# 4) Damage one and mark Damaged
curl -X POST "http://127.0.0.1:8000/inventory/items/1011/adjust" \
  -H "Content-Type: application/json" \
  -d '{"delta": -1, "reason": "damage", "set_status": "Damaged", "notes": "Cracked case"}'
```

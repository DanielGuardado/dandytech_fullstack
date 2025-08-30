# Project at a glance

* **Goal:** Full-stack inventory & PO system for a video-game reselling business.
* **Backend:** FastAPI + SQLAlchemy Core (pyodbc → SQL Server).
* **Frontend:** React, grid/spreadsheet UX; keyboard-first editing.
* **Flow:** Catalog → PriceCharting link (games/consoles) → Purchase Orders → Receiving → Inventory (edit/adjust) → (future: listings/sales).

# Database (clean baseline, highlights)

* **CatalogProducts**: `category_id`, `title`, `upc (unique)`, `pricecharting_id (nullable, unique)`, `not_on_pc bit`; `attributes_json` for catalog-level data.

  * Children: `CatalogProductGames` (platform, region, edition), `CatalogProductConsoles` (model, storage, firmware\_sensitive), link table `CatalogProductPlatforms`.
* **VariantTypes**: `LOOSE`, `ORIGINAL_PACKAGING`, `NEW`.
* **ListingVariants**: `(catalog_product_id, variant_type_id, packaging_type)`, `current_market_value` cache, `default_list_price`.

  * Auto-created for games/consoles when linked to PriceCharting.
* **Lookups**: `ConditionGrades`, `PaymentMethods`, `Platforms`, `Sources` (seeded: Mercari MC, eBay EB, Facebook FB), `Categories` (Video Game, Console, …).
* **PurchaseOrders**: costs (subtotal/tax/shipping/fees/discounts → `total_cost` persisted), `status`, `is_locked`.
* **PurchaseOrderItems**: `allocation_basis` (+ source), `cost_assignment_method ('by_market_value' | 'manual')`, `allocated_unit_cost`, `receive_status`, qtys.
* **ReceivingEvents**: audit of receive/short/damage/overage etc.
* **InventoryItems**: `seller_sku (unique)`, `quantity`, `allocated_unit_cost`, `list_price`, `condition_grade_id`, `status ('Pending','Active','Sold','Reserved','Archived','Damaged')`, `title_suffix`, `location`, `unit_attributes_json` (per-unit details), computed: `tested`, `serial_number`, `is_locked`.
* **Attribute Profiles (dynamic fields by category)**

  * `AttributeProfiles`, `AttributeProfileFields`, `CategoryAttributeProfiles`.
  * Seeded example profiles for **inventory\_item**: `InventoryItem:VideoGame` and `InventoryItem:Console` with sensible fields (e.g., games: `tested`, `disc_details`, `case_condition`…; consoles: `firmware`, `serial_number`, …).
  * Extendable (e.g., add an **Amiibo** profile later and map that category).
* **Views**: `vPO_Progress`, `vInventory_OnHand`, `vPO_WriteOffs`.
* **Proc:** `usp_AllocatePurchaseOrderCosts` allocates `total_cost` across PO lines by weight (`allocation_basis * qty`) while respecting manual unit costs.
* **Migrations:** single-pass DDL baseline; `dbo.SchemaMigrations` log; tiny runner `scripts/migrate.py` applies migrations → procs → seeds; uses `sp_getapplock`.

# API surface (MVP)

## Catalog

* **POST** `/catalog/products` — create product (+ child rows for Games/Consoles).
* **GET** `/catalog/search?q=...` — by title/platform/upc.
* **POST** `/catalog/products/{id}/variants` — add custom variant.

## PriceCharting (games/consoles only)

* **GET** `/catalog/{id}/pricecharting/search` — UPC-first, then text search.
* **POST** `/catalog/{id}/pricecharting/link` — save `pricecharting_id`, auto-create 3 variants (LOOSE/ORIGINAL\_PACKAGING/NEW), set `current_market_value`.
* **POST** `/catalog/{id}/pricecharting/not-on-pc` — opt-out, clears link.

## Purchase Orders

* **POST** `/purchase-orders` — create (status=`open`, `is_locked=false`).
* **POST** `/purchase-orders/{po}/items` — add line.

  * **Defaults:** front-end pre-fills `allocation_basis` from variant `current_market_value` if present; `cost_assignment_method` usually `by_market_value` (or `manual`).
* **POST** `/purchase-orders/{po}/lock` — validate, run `usp_AllocatePurchaseOrderCosts`, set `is_locked=true` (PO frozen for pricing).
* **GET** `/purchase-orders?limit=&offset=` — list.
* **GET** `/purchase-orders/{po}` — header + items.

## Receiving (MVP)

* **GET** `/receiving/staging-template?purchase_order_id=...&include_non_receivable=false`

  * Returns rows where `remaining = quantity_expected - quantity_received > 0` (or plus non-receivable if asked).
  * Includes: `purchase_order_item_id`, `variant_id`, `catalog_product_id`, `remaining`, display context (title, platform, variant type, market value, allocated\_unit\_cost), and **`sku_preview`** (format **`{PO_NUMBER}_{SEQ3}_{PO_ITEM_ID_PAD4}`**, underscores as agreed).
* **POST** `/receiving/commit`

  ```json
  {
    "purchase_order_id": 1,
    "items": [
      {
        "purchase_order_item_id": 101,
        "qty_to_receive": 2,
        "damaged": false,
        "short": false,
        "seq3": 1,
        "updated_at": "2025-08-27T00:00:00.000Z"
      }
    ]
  }
  ```

  * **Requirements:** PO must be `is_locked=1`.
  * **Logic:** re-check remaining, create one **InventoryItem cohort** per staged row with generated **SKU** (using the preview format), set `quantity=qty_to_receive`, `allocated_unit_cost` from POI, `status='Damaged'` if flagged else `'Pending'`, `condition_grade_id='UNKNOWN'` initially.
  * Log `ReceivingEvent('receive')` and any `damage/short/overage`.
  * Update POI `quantity_received` and `receive_status`.
  * Returns `{ inventory_item_ids: [...], po_progress: {...} }`.

## Inventory (browse, edit, adjust)

* **GET** `/inventory/items?po_id=&status=&limit=&offset=&sort=...`

  * Works with or without `po_id`; returns rich context for the grid:

    * Base: `inventory_item_id`, `seller_sku`, `quantity`, `allocated_unit_cost`, `list_price`, `condition_grade_id` (+ grade code/name), `status`, `title_suffix`, `location`, `unit_attributes_json`, computed `tested`, `serial_number`, timestamps.
    * Context: product `title`, `category_name`, (game) `platform_name`, variant code/name, `current_market_value`, and optional `profile_id/profile_name` if you choose to include it.
* **PATCH** `/inventory/items/{id}` (blur-style partial updates)

  * Editable: `seller_sku`, `list_price`, `condition_grade_id`, `title_suffix`, `location`.
  * Dynamic SQL `SET` for only provided fields; updates `updated_at`.
* **PUT** `/inventory/items/{id}/attributes`

  * Body: `{ "unit_attributes_json": { ... } }`
  * Resolves the **attribute profile** by the item’s category (and later variant), validates types/required/enums/regex, then persists `unit_attributes_json`. Returns `profile_id`, `profile_version`, `updated_at`.
* **POST** `/inventory/items/{id}/adjust` *(designed for stock/status changes)*

  * Body (shape we agreed): `{ "delta": int|null, "new_status": "Pending|Active|Sold|Reserved|Archived|Damaged"|null, "reason": "cycle_count|damage|loss|correction|found"|null, "notes": "..." }`
  * Effects: changes `quantity` (if `delta`), changes `status` (if provided), auto-archives when appropriate, and appends an **InventoryEvent** row capturing before/after, reason, notes.
  * (We deferred strict attribute enforcement on `Active` for now; easy to enable later.)

# Attribute profiles & frontend dynamic fields

* The frontend can **resolve fields dynamically** for each row:

  * **Option A (chosen for now):** call **`GET /attributes/profiles/resolve`** with `inventory_item_id` per row to get the profile+field list. This is simple to wire and fine unless perf says otherwise.
  * **Option B (later):** bulk-prefetch mappings by `(entity, category_id [, variant_type_id])` and cache client-side.
* **Games** (category “Video Game”): fields like `tested`, `inserts`, `disc_details`, `case_condition`, `cartridge_condition`, `art_condition`, `notes`, `defects`.
* **Consoles** (category “Console”): `firmware`, `serial_number`, `model_number`, `condition_description`, `tested`, `thermal_paste_replaced`, `controller_description`, `cables_included`, `memory_card_included`, `notes`.
* **Amiibos**: we have the category seeded; to support dynamic fields, add a profile (e.g., `InventoryItem:Amiibo` with `box_condition`, `figure_condition`, `tested` (n/a), `notes`) and map via `CategoryAttributeProfiles`. Frontend then renders those fields automatically via the same resolve call.

# Purchase Order states & “complete”

* Current PO `status` progression we use: `open → partially_received → received / closed_with_exceptions` (plus `returned/cancelled`).
* You proposed **`complete`** = “all items received and all received inventory items are `is_locked=1`.” We treated that as a **planned enhancement** (status not yet added to the DB enum); easy to add in a future migration + service check.

# Concurrency & transactions

* **Pattern:** Router thin → Service owns transaction (`with db.begin()`), Repo does SQL only (no `begin()` to avoid nested transaction errors).
* For sensitive updates (POI receive counts), we use **optimistic concurrency**: client passes the **last seen `updated_at`** (ISO string) and SQL checks it in the `WHERE`. If mismatch → `409` with “refresh and retry”.
* Receiving requires PO `is_locked=1`.

# SKU format (receiving)

* Final format (and UI preview): **`{PO_NUMBER}_{SEQ3}_{PO_ITEM_ID_PAD4}`**, using underscores (your preference).

  * Example: `PO123_007_0101` means PO `PO123`, sequence `007`, PO line `101`.

# Seeds / migrations / runner

* Seeds split by domain (`categories.sql`, `variant_types.sql`, `condition_grades.sql`, `payment_methods.sql`, `sources.sql`, `platforms.sql`, `attribute_profiles_inventory.sql`, `category_attribute_profiles.sql`) — all idempotent.
* `scripts/migrate.py`:

  * Orders and applies `db/migrations/*.sql`, records to `dbo.SchemaMigrations` (sha256, duration, applied\_by).
  * Then (re)creates procs from `db/procs/`.
  * Then runs all seeds in `db/seeds/`.
  * Uses `sp_getapplock` to avoid concurrent runs.
  * Optional FastAPI startup hook (`MIGRATE_ON_STARTUP=1`).

# End-to-end frontend flow (happy path)

1. **Create PO** → `POST /purchase-orders`.
2. **Find/Make Product** → search `GET /catalog/search`; if missing, `POST /catalog/products` (+ child row for game/console).
3. **Link to PriceCharting** (games/consoles): `GET /catalog/{id}/pricecharting/search` → `POST /link` or `/not-on-pc`.

   * On link, 3 variants auto-created; `current_market_value` set.
4. **Add PO line** → `POST /purchase-orders/{po}/items` (prefill `allocation_basis` from variant `current_market_value` when present; method `by_market_value` or `manual`).
5. **Lock PO** → `POST /purchase-orders/{po}/lock` (validates, allocates costs).
6. **Receiving**:

   * Stage view → `GET /receiving/staging-template?purchase_order_id=...` shows remaining+context and **sku\_preview**.
   * Commit → `POST /receiving/commit` to create InventoryItem cohorts + log events; PO item receive\_status updates; response returns created item ids + progress.
7. **Inventory management**:

   * Browse grid → `GET /inventory/items?po_id=...` (rich context).
   * Inline edits (on blur) → `PATCH /inventory/items/{id}`.
   * Edit per-unit attributes → `PUT /inventory/items/{id}/attributes` (frontend can first call `/attributes/profiles/resolve?inventory_item_id=...` to know fields).
   * Stock/status adjustments → `POST /inventory/items/{id}/adjust` (logs `InventoryEvents`).

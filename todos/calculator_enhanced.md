# 📌 Feature Changes Breakdown (with Current Behavior)

## 1. Shipping Cost Features (Highest Priority)

* **\[ ] Assign shipping cost at the add calculator item window**

  * **Current behavior:**

    * Shipping cost is included in the calculation breakdown.
    * It’s helpful, but right now the shipping cost is **auto-assigned** only from `PurchaseCalculatorConfig`.
  * **New behavior:**

    * When adding a calculator item, we should have the ability to **manually assign the shipping cost**.
    * Defaults should still come from `PurchaseCalculatorConfig`, but users can override them.

* **\[ ] Display & Edit shipping cost in table**

  * **After implementing the above:**

    * Ability to **see the shipping cost on the table** for each line item.

---

## 2. Session-Level Toggles

Two new global toggles that impact **all line items** in the session.

* **\[ ] Toggle Cashback Purchase**

  * **Current behavior:**

    * Cashback is always ON for everything.
    * These changes only affect **`regular_cashback`** (not all cashback types).
  * **New behavior:**

    * **Default:** Cashback ON (same as now, but configurable later).
    * **Toggle OFF:**

      * All line items’ `total_cashback` switch to `0`.
      * Any newly added items default to `0`.
    * **Toggle back ON:**

      * Recalculate cashback for all line items.
      * New items added after will include cashback again.
    * **Example workflow:**

      * Start session → cashback ON.
      * Toggle OFF → existing line items updated to `0`, new items come in at `0`.
      * Toggle ON again → recalc existing items, new items include cashback.

* **\[ ] Toggle Tax Exempt**

  * **Current behavior:**

    * Tax exempt is always assumed ON (applies everywhere).
  * **New behavior:**

    * **Default:** Tax exempt ON.
    * Logic mirrors cashback toggle:

      * OFF → remove exemption, recalc all items.
      * ON → apply exemption again, recalc all items.

---

## 3. UI Changes

* **\[ ] Consolidate Markup & Deductions**

  * **Current behavior:**

    * Markup and deductions are shown separately in different columns.
  * **New behavior:**

    * Merge into a single column called **“Adjustments”**.
    * Tooltip on hover should show the breakdown (markup vs deductions).

---

## 4. Frontend/Backend Integrations

* **\[ ] Edit Line Items**

  * **Current behavior:**

    * Line items are fixed once added. No inline editing of Variant, qty, etc.
  * **New behavior:**

    * Allow inline editing of the following fields:

      * Variant
      * Quantity (qty)
      * Market
      * Adjustments (markup/deductions column)
    * Auto-calculated fields remain unchanged.
    * ⚠️ **Special case:** Switching Variants

      * Needs careful mapping of how recalculations are applied:

        * Price
        * Cashback
        * Tax
        * Shipping
      * Switching variant may cascade recalculations across the row.

---

# ✅ Implementation Order

1. **Shipping Cost Feature (assign & display/edit shipping cost)**
2. **Session Toggles (cashback, tax exempt)**
3. **UI Changes (consolidated adjustments column)**
4. **Edit Line Items (incl. variant switching logic)**

---

Would you like me to also **make a flow diagram (Mermaid)** that visually shows:

* How session toggles (cashback/tax) propagate recalcs
* How shipping cost defaults vs overrides work
* How variant switching triggers recalcs

That way you’ll have a visual blueprint for devs/AI agents to follow.

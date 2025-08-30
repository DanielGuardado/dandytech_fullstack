CREATE OR ALTER PROCEDURE dbo.usp_AllocatePurchaseOrderCosts
  @purchase_order_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  BEGIN TRAN;

  /* 1) Pull PO header total */
  DECLARE @total_cost DECIMAL(12,2);

  SELECT @total_cost = total_cost
  FROM dbo.PurchaseOrders
  WHERE purchase_order_id = @purchase_order_id;

  IF @total_cost IS NULL
  BEGIN
    RAISERROR('Purchase order not found.', 16, 1);
    ROLLBACK TRANSACTION; RETURN;
  END

  /* 2) Manual lines must have allocated_unit_cost set explicitly */
  IF EXISTS (
    SELECT 1
    FROM dbo.PurchaseOrderItems
    WHERE purchase_order_id = @purchase_order_id
      AND cost_assignment_method = 'manual'
      AND (allocated_unit_cost IS NULL)
  )
  BEGIN
    RAISERROR('Manual lines require allocated_unit_cost before allocation.', 16, 1);
    ROLLBACK TRANSACTION; RETURN;
  END

  /* 3) Sum manual cost to remove it from the pool */
  DECLARE @manual_total DECIMAL(12,2) = (
    SELECT COALESCE(SUM(CAST(allocated_unit_cost AS DECIMAL(12,4)) * quantity_expected), 0)
    FROM dbo.PurchaseOrderItems
    WHERE purchase_order_id = @purchase_order_id
      AND cost_assignment_method = 'manual'
  );

  IF @manual_total > @total_cost
  BEGIN
    RAISERROR('Manual allocated total exceeds PO total_cost.', 16, 1);
    ROLLBACK TRANSACTION; RETURN;
  END

  DECLARE @pool DECIMAL(12,2) = @total_cost - @manual_total;

  /* 4) Build market-value pool: weight = allocation_basis * qty_expected */
  ;WITH mv AS (
    SELECT
      purchase_order_item_id,
      quantity_expected,
      allocation_basis,
      weight = CAST(allocation_basis AS DECIMAL(18,6)) * CAST(quantity_expected AS DECIMAL(18,6))
    FROM dbo.PurchaseOrderItems
    WHERE purchase_order_id = @purchase_order_id
      AND cost_assignment_method = 'by_market_value'
      AND quantity_expected > 0
      AND allocation_basis > 0
  )
  SELECT * INTO #mv FROM mv;

  DECLARE @pool_weight DECIMAL(18,6) = (
    SELECT COALESCE(SUM(weight), 0) FROM #mv
  );

  /* If there are MV lines but no weight, that’s a data issue */
  IF EXISTS (SELECT 1 FROM dbo.PurchaseOrderItems
             WHERE purchase_order_id = @purchase_order_id
               AND cost_assignment_method = 'by_market_value')
     AND @pool_weight = 0
  BEGIN
    RAISERROR('By-market lines have zero total weight (check allocation_basis and quantities).', 16, 1);
    ROLLBACK TRANSACTION; RETURN;
  END

  /* 5) Update allocated_unit_cost for market-value lines */
  IF @pool_weight > 0 AND @pool > 0
  BEGIN
    ;WITH shares AS (
      SELECT
        m.purchase_order_item_id,
        allocated_total = CAST(@pool AS DECIMAL(18,6)) * (m.weight / @pool_weight)
      FROM #mv m
    ),
    unitcosts AS (
      SELECT
        s.purchase_order_item_id,
        allocated_unit_cost = CASE
          WHEN poi.quantity_expected = 0 THEN 0
          ELSE ROUND( CAST(s.allocated_total AS DECIMAL(18,6))
                      / CAST(poi.quantity_expected AS DECIMAL(18,6)), 2)
        END
      FROM shares s
      JOIN dbo.PurchaseOrderItems poi
        ON poi.purchase_order_item_id = s.purchase_order_item_id
    )
    UPDATE poi
      SET poi.allocated_unit_cost = u.allocated_unit_cost
    FROM dbo.PurchaseOrderItems poi
    JOIN unitcosts u
      ON u.purchase_order_item_id = poi.purchase_order_item_id;
  END
  ELSE
  BEGIN
    /* No pool to allocate: set MV lines to zero cost */
    UPDATE poi
      SET poi.allocated_unit_cost = 0
    FROM dbo.PurchaseOrderItems poi
    WHERE poi.purchase_order_id = @purchase_order_id
      AND poi.cost_assignment_method = 'by_market_value';
  END

  /* 6) Leave manual lines exactly as the user set them (no change) */

  COMMIT TRAN;
END
GO
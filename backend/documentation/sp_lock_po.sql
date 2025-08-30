CREATE OR ALTER PROCEDURE dbo.usp_LockPurchaseOrder
  @purchase_order_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  BEGIN TRAN;

  -- 1) Verify PO exists
  IF NOT EXISTS (SELECT 1 FROM dbo.PurchaseOrders WHERE purchase_order_id = @purchase_order_id)
  BEGIN
    RAISERROR('Purchase order not found.',16,1);
    ROLLBACK TRANSACTION; RETURN;
  END

  -- 2) Block if already locked
  IF EXISTS (SELECT 1 FROM dbo.PurchaseOrders WHERE purchase_order_id = @purchase_order_id AND is_locked = 1)
  BEGIN
    RAISERROR('Purchase order is already locked.',16,1);
    ROLLBACK TRANSACTION; RETURN;
  END

  -- 3) Ensure manual lines have explicit costs
  IF EXISTS (
    SELECT 1
    FROM dbo.PurchaseOrderItems
    WHERE purchase_order_id = @purchase_order_id
      AND cost_assignment_method = 'manual'
      AND allocated_unit_cost IS NULL
  )
  BEGIN
    RAISERROR('Manual PO items require allocated_unit_cost before locking.',16,1);
    ROLLBACK TRANSACTION; RETURN;
  END

  -- 4) Run allocation once to finalize costs (freezing policy)
  EXEC dbo.usp_AllocatePurchaseOrderCosts @purchase_order_id;

  -- 5) Mark locked
  UPDATE dbo.PurchaseOrders
  SET is_locked = 1,
      updated_at = SYSDATETIME()
  WHERE purchase_order_id = @purchase_order_id;

  COMMIT TRAN;
END
GO

EXEC dbo.usp_LockPurchaseOrder @purchase_order_id = 123;

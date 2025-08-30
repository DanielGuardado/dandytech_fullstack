MERGE dbo.PaymentMethods AS tgt
USING (VALUES
  ('Cash','Cash',1),
  ('CreditCard','Credit Card',1),
  ('PayPal','PayPal',1),
  ('eBayManaged','eBay Managed Payments',1),
  ('Zelle','Zelle',1),
  ('ACH','ACH',1),
  ('StoreCredit','Store Credit',1),
  ('Other','Other',1)
) AS src(code, display_name, is_active)
ON tgt.code = src.code
WHEN NOT MATCHED BY TARGET THEN
  INSERT (code, display_name, is_active) VALUES (src.code, src.display_name, src.is_active)
WHEN MATCHED AND (tgt.display_name <> src.display_name OR tgt.is_active = 0) THEN
  UPDATE SET display_name = src.display_name, is_active = 1;
GO
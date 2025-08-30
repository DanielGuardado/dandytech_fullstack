MERGE dbo.Sources AS tgt
USING (VALUES
  (N'MC', N'Mercari',               N'Marketplace'),
  (N'EB', N'eBay',                  N'Marketplace'),
  (N'FB', N'Facebook Marketplace',  N'Marketplace')
) AS src(code, name, type)
ON tgt.code = src.code
WHEN NOT MATCHED BY TARGET THEN
  INSERT (code, name, type) VALUES (src.code, src.name, src.type)
WHEN MATCHED AND (tgt.name <> src.name OR tgt.type <> src.type OR tgt.is_active = 0) THEN
  UPDATE SET name = src.name, type = src.type, is_active = 1;
GO
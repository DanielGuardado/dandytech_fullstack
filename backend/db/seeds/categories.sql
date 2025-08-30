MERGE dbo.Categories AS tgt
USING (VALUES
  (N'Video Game', 1),
  (N'Console',    1),
  (N'Controller', 1),
  (N'Accessory',  1),
  (N'Amiibo',     1),
  (N'Funko Pop',  1)
) AS src(name, is_active)
ON tgt.name = src.name
WHEN NOT MATCHED BY TARGET THEN
  INSERT (name, is_active) VALUES (src.name, src.is_active)
WHEN MATCHED AND (tgt.is_active <> src.is_active) THEN
  UPDATE SET is_active = src.is_active;
GO
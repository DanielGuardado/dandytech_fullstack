MERGE dbo.VariantTypes AS tgt
USING (VALUES
  ('LOOSE', 'Loose', 1),
  ('ORIGINAL_PACKAGING', 'Original Packaging', 1),
  ('NEW', 'New', 1),
  ('CIB', 'Complete in Box', 1)
) AS src(code, display_name, is_active)
ON tgt.code = src.code
WHEN NOT MATCHED BY TARGET THEN
  INSERT (code, display_name, is_active) VALUES (src.code, src.display_name, src.is_active)
WHEN MATCHED AND (tgt.display_name <> src.display_name OR tgt.is_active = 0) THEN
  UPDATE SET display_name = src.display_name, is_active = 1;
GO
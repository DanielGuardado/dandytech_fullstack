MERGE dbo.ConditionGrades AS tgt
USING (VALUES
  ('UNKNOWN','Not Specified','Condition not yet graded',99),
  ('LIKE_NEW','Like New','Minimal/no wear, open but pristine',1),
  ('VERY_GOOD','Very Good','Light wear, fully functional',2),
  ('VERY_GOOD_REFURB','Very Good (Refurbished)','Refurbished to very good condition',3),
  ('GOOD','Good','Noticeable wear, fully functional',4),
  ('GOOD_REFURB','Good (Refurbished)','Refurbished to good condition',5),
  ('EXCELLENT_REFURB','Excellent (Refurbished)','Refurbished to excellent condition',6),
  ('OPEN_BOX','Open Box','Opened but unused',7),
  ('FOR_PARTS','For Parts','Not fully functional, may be salvaged',8),
  ('DAMAGED','Damaged','Broken or defective',9)
) AS src(code, display_name, description, rank)
ON tgt.code = src.code
WHEN NOT MATCHED BY TARGET THEN
  INSERT (code, display_name, description, rank) VALUES (src.code, src.display_name, src.description, src.rank)
WHEN MATCHED AND (tgt.display_name <> src.display_name OR tgt.description <> src.description OR tgt.rank <> src.rank OR tgt.is_active = 0) THEN
  UPDATE SET display_name = src.display_name, description = src.description, rank = src.rank, is_active = 1;
GO
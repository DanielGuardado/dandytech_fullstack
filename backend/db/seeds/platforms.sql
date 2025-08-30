DECLARE @cat_video_games INT = (
  SELECT TOP 1 category_id FROM dbo.Categories WHERE name = N'Video Game'
);
IF @cat_video_games IS NULL
  THROW 50002, 'Seed categories first: missing ''Video Game''', 1;

MERGE dbo.Platforms AS tgt
USING (VALUES
    (N'PlayStation',                    N'PS1',     1),
    (N'PlayStation 2',                  N'PS2',     1),
    (N'PlayStation 3',                  N'PS3',     1),
    (N'PlayStation 4',                  N'PS4',     1),
    (N'PlayStation 5',                  N'PS5',     1),
    (N'PlayStation Vita',               N'PS Vita', 1),
    (N'PlayStation Portable',           N'PSP',     1),
    (N'Xbox',                           N'Xbox',    0),
    (N'Xbox 360',                       N'360',     0),
    (N'Xbox One',                       N'XONE',    0),
    (N'Xbox Series X|S',                N'XSX|S',   0),
    (N'Nintendo Entertainment System',  N'NES',     1),
    (N'Super Nintendo Entertainment System', N'SNES', 1),
    (N'Nintendo 64',                    N'N64',     1),
    (N'GameCube',                       N'GC',      1),
    (N'Wii',                            N'Wii',     0),
    (N'Wii U',                          N'WiiU',    0),
    (N'Nintendo Switch',                N'Switch',  0),
    (N'Game Boy',                       N'GB',      1),
    (N'Game Boy Color',                 N'GBC',     1),
    (N'Game Boy Advance',               N'GBA',     1),
    (N'Nintendo DS',                    N'DS',      1),
    (N'Nintendo 3DS',                   N'3DS',     1)
) AS src(name, short_name, include_short_name)   -- ← define the 3rd column here
ON tgt.name = src.name
WHEN NOT MATCHED BY TARGET THEN
  INSERT (name, short_name, include_short_name, category_id)
  VALUES (src.name, src.short_name, src.include_short_name, @cat_video_games)
WHEN MATCHED AND (
       ISNULL(tgt.short_name, N'') <> src.short_name
    OR ISNULL(tgt.include_short_name, 0) <> src.include_short_name
    OR tgt.category_id <> @cat_video_games
    OR ISNULL(tgt.is_active, 1) = 0
)
THEN UPDATE SET
    short_name          = src.short_name,
    include_short_name  = src.include_short_name,
    category_id         = @cat_video_games,
    is_active           = 1;
GO

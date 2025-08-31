-- Add video_game_manual_sensitive column to Platforms table
-- This indicates if games on this platform require manuals for CIB pricing

ALTER TABLE dbo.Platforms 
ADD video_game_manual_sensitive BIT NOT NULL DEFAULT 0;
GO

-- Set manual-sensitive platforms
-- These platforms had physical manuals that are expected for CIB condition
UPDATE dbo.Platforms 
SET video_game_manual_sensitive = 1
WHERE short_name IN ('PS2', 'PS3', 'Xbox', '360', 'GC', 'Wii');
GO

-- Verify the update
SELECT platform_id, name, short_name, video_game_manual_sensitive 
FROM dbo.Platforms 
WHERE video_game_manual_sensitive = 1
ORDER BY name;
GO
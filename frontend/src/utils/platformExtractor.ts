import { Platform } from '../types/api';

interface PlatformToken {
  token: string;
  platformId: number;
  platformName: string;
}

export interface PlatformExtractionResult {
  title: string;
  platformId: number | null;
  platformName: string | null;
}

export function extractPlatformFromQuery(
  query: string, 
  platforms: Platform[]
): PlatformExtractionResult {
  if (!query || !platforms || platforms.length === 0) {
    return { title: query || '', platformId: null, platformName: null };
  }

  // Build platform token map from database platforms
  const platformTokens: PlatformToken[] = [];
  
  platforms.forEach(platform => {
    // Add platform name as token
    if (platform.name) {
      platformTokens.push({
        token: platform.name.toLowerCase().trim(),
        platformId: platform.platform_id,
        platformName: platform.name
      });
    }
    
    // Add short_name as token (if different from name)
    if (platform.short_name && platform.short_name.toLowerCase() !== platform.name?.toLowerCase()) {
      platformTokens.push({
        token: platform.short_name.toLowerCase().trim(),
        platformId: platform.platform_id,
        platformName: platform.name
      });
    }
  });

  // Sort by token length (longest first) for accurate matching
  // This ensures "Nintendo 3DS" is matched before "3DS"
  platformTokens.sort((a, b) => b.token.length - a.token.length);

  // Normalize query for matching
  const normalizedQuery = query.toLowerCase().trim();
  
  // Try to find platform token in query
  for (const { token, platformId, platformName } of platformTokens) {
    if (!token) continue;
    
    // Pattern 1: Query ends with platform token
    if (normalizedQuery.endsWith(token)) {
      const remainingText = query.substring(0, query.length - token.length).trim();
      if (remainingText) {
        return { 
          title: remainingText, 
          platformId, 
          platformName 
        };
      }
    }
    
    // Pattern 2: Platform appears with common separators
    const separatorPatterns = [
      { pattern: ` for ${token}`, includeWords: false },
      { pattern: ` on ${token}`, includeWords: false },
      { pattern: ` - ${token}`, includeWords: false },
      { pattern: ` (${token})`, includeWords: false },
      { pattern: ` [${token}]`, includeWords: false },
      { pattern: ` ${token}`, includeWords: true } // Simple space separator (check this last)
    ];
    
    for (const { pattern, includeWords } of separatorPatterns) {
      const index = normalizedQuery.indexOf(pattern);
      if (index > 0) {
        let title = query.substring(0, index).trim();
        
        // For "for" and "on" patterns, don't include the connecting word
        if (!includeWords) {
          title = query.substring(0, index).trim();
        }
        
        if (title) {
          return { 
            title, 
            platformId, 
            platformName 
          };
        }
      }
    }
  }

  // No platform found, return original query
  return { 
    title: query, 
    platformId: null, 
    platformName: null 
  };
}

/**
 * Helper function to clean up title text by removing common platform-related words
 * that might have been missed by the main extraction
 */
export function cleanTitle(title: string): string {
  return title
    .trim()
    // Remove trailing separators that might be left over
    .replace(/[\s\-()[\]]+$/, '')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}
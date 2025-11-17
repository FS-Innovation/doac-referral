-- Migration: Add Apple Podcasts redirect option
-- Date: 2025-11-17
-- Purpose: Add Apple Podcasts as a third platform option

-- Add Apple Podcasts URL to settings
INSERT INTO settings (key, value)
VALUES ('redirect_url_apple', 'https://podcasts.apple.com/rs/podcast/no-1-sleep-expert-magnesium-isnt-helping-you-sleep/id1291423644?i=1000737045389')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verify
SELECT * FROM settings WHERE key LIKE 'redirect_url%';

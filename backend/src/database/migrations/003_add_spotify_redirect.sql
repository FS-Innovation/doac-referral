-- Migration: Add Spotify redirect option
-- Date: 2025-11-17
-- Purpose: Allow users to choose between YouTube or Spotify redirect

-- 1. Add platform preference column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS redirect_platform VARCHAR(20) DEFAULT 'youtube';

-- 2. Add default Spotify URL to settings (podcast episode, not track)
INSERT INTO settings (key, value)
VALUES ('redirect_url_spotify', 'https://open.spotify.com/episode/6L11cxCLi0V6mhlpdzLokR')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. Ensure default YouTube URL exists
INSERT INTO settings (key, value)
VALUES ('redirect_url', 'https://youtu.be/qxxnRMT9C-8')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Add comment for documentation
COMMENT ON COLUMN users.redirect_platform IS 'User preference for referral redirect: youtube or spotify (default: youtube)';

-- 5. Verify
SELECT * FROM settings WHERE key LIKE 'redirect_url%';

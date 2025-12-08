-- Add selected_episode_id column to users table
-- Stores YouTube video ID (e.g., "4QLWlcneJig") or NULL for "Latest" (always show newest episode)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS selected_episode_id VARCHAR(20) DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.selected_episode_id IS 'YouTube video ID of the user''s selected episode. NULL means "Latest" (always share the newest episode)';

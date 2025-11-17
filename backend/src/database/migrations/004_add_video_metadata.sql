-- Migration: Add video metadata caching
-- Date: 2025-11-17
-- Purpose: Cache YouTube/Spotify metadata to avoid repeated API calls

-- Create video_metadata table
CREATE TABLE IF NOT EXISTS video_metadata (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(20) NOT NULL, -- 'youtube' or 'spotify'
  video_url TEXT NOT NULL,
  video_id VARCHAR(255) NOT NULL, -- YouTube video ID or Spotify episode ID
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  duration INTEGER, -- Duration in seconds
  channel_name TEXT, -- YouTube channel or Spotify show name
  published_at TIMESTAMP,
  view_count BIGINT, -- YouTube views
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform, video_id)
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_video_metadata_platform ON video_metadata(platform);
CREATE INDEX IF NOT EXISTS idx_video_metadata_video_id ON video_metadata(video_id);

-- Add comment
COMMENT ON TABLE video_metadata IS 'Cached metadata from YouTube/Spotify APIs. Refreshed when admin updates video URLs.';

-- Create episodes table for episode selector feature
CREATE TABLE IF NOT EXISTS episodes (
  id SERIAL PRIMARY KEY,
  episode_number INTEGER UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  youtube_video_id VARCHAR(20) NOT NULL,
  duration INTEGER, -- seconds
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  view_count INTEGER DEFAULT 0,
  youtube_url VARCHAR(500) NOT NULL,
  spotify_url VARCHAR(500),
  apple_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_episodes_published_at ON episodes(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_is_active ON episodes(is_active);
CREATE INDEX IF NOT EXISTS idx_episodes_episode_number ON episodes(episode_number);

-- Migration: Episode Tracking Enhancement
-- Run with: npx ts-node src/scripts/run-migration.ts migrations/015_episode_tracking_enhancement.sql
--
-- This migration enhances episode tracking for comprehensive analytics:
-- 1. Adds episode_id to referral_clicks to track which episode drove each conversion
-- 2. Creates episode_selection_history table for time-series analysis
-- 3. Adds source_episode_id to users to track what episode brought them to sign up

-- ============================================================================
-- 1. ADD EPISODE TRACKING TO REFERRAL_CLICKS
-- ============================================================================
-- Track which episode was being promoted when a referral click occurred
ALTER TABLE referral_clicks
  ADD COLUMN IF NOT EXISTS episode_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS platform VARCHAR(20);

COMMENT ON COLUMN referral_clicks.episode_id IS 'YouTube video ID of the episode that was being shared when click occurred';
COMMENT ON COLUMN referral_clicks.platform IS 'Platform clicked: youtube, spotify, apple';

-- Index for episode performance analysis
CREATE INDEX IF NOT EXISTS idx_referral_clicks_episode_id ON referral_clicks(episode_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_platform ON referral_clicks(platform);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_episode_platform ON referral_clicks(episode_id, platform);

-- ============================================================================
-- 2. CREATE EPISODE SELECTION HISTORY TABLE
-- ============================================================================
-- Time-series data for user episode selection behavior
-- Enables analysis of: which episodes users select, how often they change, patterns over time

CREATE TABLE IF NOT EXISTS episode_selection_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What they changed FROM (null if first selection or changing from LATEST mode)
  previous_episode_id VARCHAR(20),

  -- What they changed TO (null means LATEST mode)
  new_episode_id VARCHAR(20),

  -- Selection mode for easier querying
  selection_mode VARCHAR(20) NOT NULL DEFAULT 'specific', -- 'latest' or 'specific'

  -- Context about how/why selection changed
  source VARCHAR(50), -- 'manual', 'url_param', 'onboarding', 'api'

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_episode_selection_user_id ON episode_selection_history(user_id);
CREATE INDEX IF NOT EXISTS idx_episode_selection_new_episode ON episode_selection_history(new_episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_selection_created_at ON episode_selection_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_episode_selection_source ON episode_selection_history(source);

COMMENT ON TABLE episode_selection_history IS 'Time-series log of user episode selection changes for analytics';

-- ============================================================================
-- 3. ADD SOURCE EPISODE TO USERS
-- ============================================================================
-- Track which episode brought the user to sign up (from ?e= parameter or referral link)
-- This is separate from selected_episode_id which is their current sharing preference

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS source_episode_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS source_referral_code VARCHAR(20);

COMMENT ON COLUMN users.source_episode_id IS 'YouTube video ID of the episode that led this user to sign up (from referral/promo link)';
COMMENT ON COLUMN users.source_referral_code IS 'Referral code that brought this user to sign up';

-- Index for acquisition analysis
CREATE INDEX IF NOT EXISTS idx_users_source_episode ON users(source_episode_id);
CREATE INDEX IF NOT EXISTS idx_users_source_referral ON users(source_referral_code);

-- ============================================================================
-- 4. CREATE EPISODE PERFORMANCE VIEW
-- ============================================================================
-- Materialized view for episode performance dashboard (can be refreshed periodically)

CREATE MATERIALIZED VIEW IF NOT EXISTS episode_performance AS
SELECT
  rc.episode_id,
  COUNT(*) as total_clicks,
  COUNT(DISTINCT rc.user_id) as unique_sharers,
  COUNT(CASE WHEN rc.platform = 'youtube' THEN 1 END) as youtube_clicks,
  COUNT(CASE WHEN rc.platform = 'spotify' THEN 1 END) as spotify_clicks,
  COUNT(CASE WHEN rc.platform = 'apple' THEN 1 END) as apple_clicks,
  COUNT(CASE WHEN rc.points_awarded = true THEN 1 END) as valid_clicks,
  DATE(rc.clicked_at) as click_date
FROM referral_clicks rc
WHERE rc.episode_id IS NOT NULL
GROUP BY rc.episode_id, DATE(rc.clicked_at)
ORDER BY click_date DESC, total_clicks DESC;

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_episode_performance_episode_date
  ON episode_performance(episode_id, click_date);

COMMENT ON MATERIALIZED VIEW episode_performance IS 'Aggregated episode performance metrics, refresh with: REFRESH MATERIALIZED VIEW episode_performance';

-- ============================================================================
-- 5. VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify:
--
-- Check referral_clicks columns:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'referral_clicks' ORDER BY ordinal_position;
--
-- Check episode_selection_history:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'episode_selection_history' ORDER BY ordinal_position;
--
-- Check users new columns:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name LIKE 'source%';

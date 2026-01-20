-- ============================================================================
-- POINT AWARDS FORENSIC LOGGING
-- ============================================================================
-- Comprehensive logging of every point award for fraud detection and
-- winner verification. This table stores all data needed to audit any
-- user's points history and detect fraudulent patterns.
-- ============================================================================

-- Main forensic logging table
CREATE TABLE IF NOT EXISTS point_awards (
  id SERIAL PRIMARY KEY,

  -- Who received the point
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL,

  -- Clicker information (the anonymous person who clicked)
  clicker_device_id VARCHAR(255),
  clicker_device_fp VARCHAR(255),
  clicker_browser_fp VARCHAR(255),
  clicker_ip VARCHAR(45),
  clicker_user_agent TEXT,

  -- Bot detection results
  bot_score INTEGER,
  bot_signals TEXT[],

  -- Execution proof (validates real browser)
  exec_duration_ms NUMERIC(10, 2),
  exec_has_webgl BOOLEAN,
  exec_has_audio BOOLEAN,
  exec_screen_consistent BOOLEAN,

  -- Timing data
  time_on_page_ms INTEGER,
  click_timestamp TIMESTAMP NOT NULL,
  award_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Platform selected
  platform VARCHAR(20), -- youtube, spotify, apple
  episode_id INTEGER,

  -- Fraud detection results
  fraud_flags TEXT[],
  confidence_score INTEGER, -- 0-100, higher = more confident it's legitimate
  was_awarded BOOLEAN DEFAULT TRUE, -- FALSE if blocked by fraud detection
  block_reason TEXT, -- If blocked, why

  -- For pattern analysis
  hour_of_day INTEGER,
  day_of_week INTEGER,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_point_awards_user_id ON point_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_point_awards_referral_code ON point_awards(referral_code);
CREATE INDEX IF NOT EXISTS idx_point_awards_clicker_device_fp ON point_awards(clicker_device_fp);
CREATE INDEX IF NOT EXISTS idx_point_awards_clicker_ip ON point_awards(clicker_ip);
CREATE INDEX IF NOT EXISTS idx_point_awards_click_timestamp ON point_awards(click_timestamp);
CREATE INDEX IF NOT EXISTS idx_point_awards_was_awarded ON point_awards(was_awarded);
CREATE INDEX IF NOT EXISTS idx_point_awards_bot_score ON point_awards(bot_score);

-- Composite index for device reuse detection across users
CREATE INDEX IF NOT EXISTS idx_point_awards_device_user ON point_awards(clicker_device_fp, user_id);

-- ============================================================================
-- CAPS TRACKING TABLE
-- ============================================================================
-- Track daily/lifetime caps per user and per code for efficient enforcement

CREATE TABLE IF NOT EXISTS referral_caps (
  id SERIAL PRIMARY KEY,

  -- What we're tracking
  cap_type VARCHAR(20) NOT NULL, -- 'user_daily', 'user_lifetime', 'code_daily'
  reference_id VARCHAR(255) NOT NULL, -- user_id or referral_code
  date DATE, -- NULL for lifetime caps

  -- Current count
  count INTEGER DEFAULT 0,

  -- When capped
  cap_reached_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Unique constraint to prevent duplicates
  CONSTRAINT unique_cap_entry UNIQUE (cap_type, reference_id, date)
);

CREATE INDEX IF NOT EXISTS idx_referral_caps_lookup ON referral_caps(cap_type, reference_id, date);

-- ============================================================================
-- IP VELOCITY TRACKING TABLE
-- ============================================================================
-- Track how many different referral codes an IP clicks per hour
-- Catches click farms and referral rings

CREATE TABLE IF NOT EXISTS ip_velocity (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  hour_bucket TIMESTAMP NOT NULL, -- Truncated to hour
  codes_clicked TEXT[] DEFAULT '{}', -- Array of unique codes clicked
  click_count INTEGER DEFAULT 0,
  flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_ip_hour UNIQUE (ip_address, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_ip_velocity_lookup ON ip_velocity(ip_address, hour_bucket);
CREATE INDEX IF NOT EXISTS idx_ip_velocity_flagged ON ip_velocity(flagged) WHERE flagged = TRUE;

-- ============================================================================
-- WINNER VERIFICATION VIEW
-- ============================================================================
-- Materialized view for quick winner analysis

CREATE MATERIALIZED VIEW IF NOT EXISTS user_points_summary AS
SELECT
  u.id as user_id,
  u.email,
  u.referral_code,
  u.points as current_points,
  u.created_at as account_created,

  -- Total awards
  COUNT(pa.id) as total_awards,
  COUNT(CASE WHEN pa.was_awarded THEN 1 END) as successful_awards,
  COUNT(CASE WHEN NOT pa.was_awarded THEN 1 END) as blocked_awards,

  -- Device diversity (more unique devices = more likely legitimate)
  COUNT(DISTINCT pa.clicker_device_fp) as unique_devices,
  COUNT(DISTINCT pa.clicker_ip) as unique_ips,

  -- Bot score stats
  AVG(pa.bot_score) as avg_bot_score,
  MIN(pa.bot_score) as min_bot_score,

  -- Timing stats
  AVG(pa.time_on_page_ms) as avg_time_on_page_ms,
  MIN(pa.time_on_page_ms) as min_time_on_page_ms,

  -- Time patterns
  COUNT(DISTINCT pa.hour_of_day) as active_hours,
  COUNT(DISTINCT pa.day_of_week) as active_days,

  -- Platform distribution
  COUNT(CASE WHEN pa.platform = 'youtube' THEN 1 END) as youtube_clicks,
  COUNT(CASE WHEN pa.platform = 'spotify' THEN 1 END) as spotify_clicks,
  COUNT(CASE WHEN pa.platform = 'apple' THEN 1 END) as apple_clicks,

  -- Suspicious indicators
  COUNT(CASE WHEN pa.bot_score < 50 THEN 1 END) as low_bot_score_count,
  COUNT(CASE WHEN pa.time_on_page_ms < 2000 THEN 1 END) as fast_click_count

FROM users u
LEFT JOIN point_awards pa ON u.id = pa.user_id
GROUP BY u.id, u.email, u.referral_code, u.points, u.created_at;

-- Index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_points_summary_user_id ON user_points_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_summary_points ON user_points_summary(current_points DESC);

-- Function to refresh the materialized view (call periodically or on-demand)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY user_points_summary;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE point_awards IS 'Forensic log of every point award attempt for fraud detection and winner verification';
COMMENT ON TABLE referral_caps IS 'Tracks daily and lifetime caps per user and per referral code';
COMMENT ON TABLE ip_velocity IS 'Tracks IP click velocity to detect click farms';
COMMENT ON MATERIALIZED VIEW user_points_summary IS 'Aggregated stats per user for quick winner verification';

-- Migration: 013_profile_enhancement.sql
-- Date: 2026-01-19
-- Purpose: Multi-step registration with profile completion, normalized tables, and A/B testing

-- ============================================================================
-- 1. INTERESTS LOOKUP TABLE (Normalized)
-- ============================================================================
CREATE TABLE IF NOT EXISTS interests (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,           -- 'health', 'business', etc.
  display_name VARCHAR(100) NOT NULL,          -- 'Health' (shown in UI)
  category_label VARCHAR(100) NOT NULL,        -- 'Healthy Living' (backend/analytics label)
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed interests (as specified in requirements)
INSERT INTO interests (slug, display_name, category_label, display_order) VALUES
  ('health', 'Health', 'Healthy Living', 1),
  ('business', 'Business', 'Business and Finance', 2),
  ('life_story', 'Life Story', 'Personal Celebrations & Life Events', 3),
  ('technology', 'Technology', 'Technology & Computing', 4),
  ('geopolitics', 'Geopolitics', 'Politics', 5)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2. USER INTERESTS JUNCTION TABLE (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_interests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest_id INT NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_interests_unique UNIQUE(user_id, interest_id)
);

CREATE INDEX IF NOT EXISTS idx_user_interests_user_id ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_interest_id ON user_interests(interest_id);

-- ============================================================================
-- 3. MARKETING CHANNELS LOOKUP TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketing_channels (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,           -- 'email', 'sms', 'community_events', etc.
  display_name VARCHAR(100) NOT NULL,          -- 'Email', 'Mobile (SMS)', etc.
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed marketing channels (as specified in requirements)
INSERT INTO marketing_channels (slug, display_name, description, display_order) VALUES
  ('email', 'Email', 'Email marketing communications', 1),
  ('sms', 'Mobile (SMS)', 'Text message notifications', 2),
  ('community_events', 'Community events', 'Invitations to community events', 3),
  ('books', 'Books', 'Book recommendations and releases', 4),
  ('product', 'Product', 'Product announcements and updates', 5),
  ('steven_newsletter', 'Steven', 'Steven Bartlett personal newsletter', 6)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 4. USER MARKETING PREFERENCES JUNCTION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_marketing_preferences (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id INT NOT NULL REFERENCES marketing_channels(id) ON DELETE CASCADE,
  opted_in BOOLEAN DEFAULT FALSE,
  opted_in_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_marketing_prefs_unique UNIQUE(user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_user_marketing_prefs_user_id ON user_marketing_preferences(user_id);

-- ============================================================================
-- 5. A/B TESTING INFRASTRUCTURE
-- ============================================================================
CREATE TABLE IF NOT EXISTS experiments (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,            -- 'dob_input_type'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  variants JSONB NOT NULL,                     -- ['date_picker', 'age_range']
  traffic_split JSONB,                         -- {date_picker: 50, age_range: 50}
  is_active BOOLEAN DEFAULT TRUE,
  start_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed DOB experiment
INSERT INTO experiments (slug, name, description, variants, traffic_split) VALUES
  ('dob_input_type', 'DOB Input Method', 'A/B test between date picker (MM/DD/YYYY) and age range dropdown',
   '["date_picker", "age_range"]', '{"date_picker": 50, "age_range": 50}')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_experiment_assignments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experiment_id INT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant VARCHAR(50) NOT NULL,                -- 'date_picker' or 'age_range'
  assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  converted_at TIMESTAMPTZ,                    -- When they completed the step
  conversion_data JSONB,                       -- {completed: true, skipped: false, time_spent_seconds: 45}
  CONSTRAINT user_experiment_unique UNIQUE(user_id, experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_user_experiments_user ON user_experiment_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_experiments_experiment ON user_experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_user_experiments_variant ON user_experiment_assignments(variant);

-- ============================================================================
-- 6. MODIFY USERS TABLE - Add New Profile Fields
-- ============================================================================

-- Add new profile fields (use DO block to handle columns that may already exist)
DO $$
BEGIN
  -- Phone number (E.164 format)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
    ALTER TABLE users ADD COLUMN phone VARCHAR(20);
  END IF;

  -- Phone verified flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone_verified') THEN
    ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
  END IF;

  -- Gender
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'gender') THEN
    ALTER TABLE users ADD COLUMN gender VARCHAR(20);
  END IF;

  -- Date of birth (full DOB for date_picker variant)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'date_of_birth') THEN
    ALTER TABLE users ADD COLUMN date_of_birth DATE;
  END IF;

  -- DOB variant (which A/B test variant user saw)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'dob_variant') THEN
    ALTER TABLE users ADD COLUMN dob_variant VARCHAR(20);
  END IF;

  -- Profile completion tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_completed_at') THEN
    ALTER TABLE users ADD COLUMN profile_completed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_completion_skipped') THEN
    ALTER TABLE users ADD COLUMN profile_completion_skipped BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_completion_step') THEN
    ALTER TABLE users ADD COLUMN profile_completion_step INT DEFAULT 0;
  END IF;

  -- Track which optional fields were completed (for analytics)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'completed_fields') THEN
    ALTER TABLE users ADD COLUMN completed_fields JSONB DEFAULT '[]';
  END IF;
END $$;

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_users_profile_completed ON users(profile_completed_at) WHERE profile_completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_dob_variant ON users(dob_variant) WHERE dob_variant IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;

-- ============================================================================
-- 7. PROFILE COMPLETION ANALYTICS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS profile_completion_analytics (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step VARCHAR(50) NOT NULL,                   -- 'page_1', 'page_2', 'page_3'
  action VARCHAR(50) NOT NULL,                 -- 'started', 'completed', 'skipped', 'abandoned'
  fields_completed JSONB,                      -- ['phone', 'interests', 'gender', 'dob']
  time_spent_seconds INT,
  metadata JSONB,                              -- Additional context
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profile_analytics_user ON profile_completion_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_analytics_step ON profile_completion_analytics(step);
CREATE INDEX IF NOT EXISTS idx_profile_analytics_action ON profile_completion_analytics(action);

-- ============================================================================
-- 8. DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE interests IS 'Lookup table for user interest categories (Health, Business, Life Story, Technology, Geopolitics)';
COMMENT ON TABLE user_interests IS 'Junction table linking users to their interests (many-to-many)';
COMMENT ON TABLE marketing_channels IS 'Lookup table for granular marketing preference channels';
COMMENT ON TABLE user_marketing_preferences IS 'User opt-in/out status per marketing channel (GDPR compliant)';
COMMENT ON TABLE experiments IS 'A/B test experiment definitions';
COMMENT ON TABLE user_experiment_assignments IS 'Which experiment variant each user was assigned and conversion tracking';
COMMENT ON TABLE profile_completion_analytics IS 'Analytics for profile completion funnel';
COMMENT ON COLUMN users.phone IS 'E.164 format phone number (+14155551234)';
COMMENT ON COLUMN users.gender IS 'Gender: male, female, non_binary, prefer_not_to_say';
COMMENT ON COLUMN users.date_of_birth IS 'Full DOB (for date_picker A/B variant)';
COMMENT ON COLUMN users.dob_variant IS 'A/B test variant: date_picker or age_range';
COMMENT ON COLUMN users.profile_completed_at IS 'Timestamp when user completed profile step';
COMMENT ON COLUMN users.profile_completion_skipped IS 'Whether user explicitly skipped profile completion';
COMMENT ON COLUMN users.completed_fields IS 'Array of optional profile fields user completed';

-- Migration: Database Normalization & Industry Standards Fixes
-- Run with: npx ts-node src/scripts/run-migration.ts migrations/012_database_normalization.sql
--
-- This migration addresses several database quality issues:
-- 1. Removes unused legacy tables (products, purchases)
-- 2. Standardizes all timestamps to TIMESTAMPTZ (timestamp with time zone)
-- 3. Adds NOT NULL constraints to foreign keys where appropriate
-- 4. Adds composite indexes for query performance
-- 5. Adds terms acceptance tracking to users

-- ============================================================================
-- 1. DROP UNUSED TABLES
-- ============================================================================
-- The products and purchases tables were from an earlier design that was
-- replaced by the prize_tiers system. They are no longer used.

DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- ============================================================================
-- 2. STANDARDIZE TIMESTAMPS TO TIMESTAMPTZ
-- ============================================================================
-- Best practice: Always use TIMESTAMPTZ for consistent timezone handling

-- password_reset_tokens
ALTER TABLE password_reset_tokens
  ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
  ALTER COLUMN used_at TYPE TIMESTAMPTZ USING used_at AT TIME ZONE 'UTC',
  ALTER COLUMN invalidated_at TYPE TIMESTAMPTZ USING invalidated_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- prize_codes
ALTER TABLE prize_codes
  ALTER COLUMN claimed_at TYPE TIMESTAMPTZ USING claimed_at AT TIME ZONE 'UTC',
  ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- prize_tiers
ALTER TABLE prize_tiers
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- referral_clicks
ALTER TABLE referral_clicks
  ALTER COLUMN clicked_at TYPE TIMESTAMPTZ USING clicked_at AT TIME ZONE 'UTC';

-- settings
ALTER TABLE settings
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- user_fingerprints
ALTER TABLE user_fingerprints
  ALTER COLUMN first_seen TYPE TIMESTAMPTZ USING first_seen AT TIME ZONE 'UTC',
  ALTER COLUMN last_seen TYPE TIMESTAMPTZ USING last_seen AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- user_prize_claims
ALTER TABLE user_prize_claims
  ALTER COLUMN claimed_at TYPE TIMESTAMPTZ USING claimed_at AT TIME ZONE 'UTC';

-- users
ALTER TABLE users
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN verification_token_expires TYPE TIMESTAMPTZ USING verification_token_expires AT TIME ZONE 'UTC',
  ALTER COLUMN verification_sent_at TYPE TIMESTAMPTZ USING verification_sent_at AT TIME ZONE 'UTC';

-- video_metadata
ALTER TABLE video_metadata
  ALTER COLUMN published_at TYPE TIMESTAMPTZ USING published_at AT TIME ZONE 'UTC',
  ALTER COLUMN last_updated TYPE TIMESTAMPTZ USING last_updated AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- ============================================================================
-- 3. ADD NOT NULL CONSTRAINTS TO FOREIGN KEYS
-- ============================================================================
-- Foreign keys should generally be NOT NULL unless there's a specific reason
-- to allow orphaned records

-- First, delete any orphaned records that would violate the constraint
DELETE FROM referral_clicks WHERE user_id IS NULL;
DELETE FROM user_fingerprints WHERE user_id IS NULL;
DELETE FROM user_prize_claims WHERE user_id IS NULL;
DELETE FROM user_prize_claims WHERE tier_id IS NULL;

-- Now add the NOT NULL constraints
ALTER TABLE referral_clicks
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE user_fingerprints
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE user_prize_claims
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN tier_id SET NOT NULL;

-- prize_codes.tier_id and claimed_by can remain nullable (codes exist before being claimed)
-- password_reset_tokens.user_id should be NOT NULL
DELETE FROM password_reset_tokens WHERE user_id IS NULL;
ALTER TABLE password_reset_tokens
  ALTER COLUMN user_id SET NOT NULL;

-- ============================================================================
-- 4. ADD COMPOSITE INDEXES FOR PERFORMANCE
-- ============================================================================
-- These indexes optimize common query patterns

-- Referral clicks: frequently queried by user + time range
CREATE INDEX IF NOT EXISTS idx_referral_clicks_user_clicked
  ON referral_clicks(user_id, clicked_at DESC);

-- User prize claims: frequently queried by user + tier
CREATE INDEX IF NOT EXISTS idx_user_prize_claims_user_tier
  ON user_prize_claims(user_id, tier_id);

-- User prize claims: for checking recent claims
CREATE INDEX IF NOT EXISTS idx_user_prize_claims_claimed_at
  ON user_prize_claims(claimed_at DESC);

-- ============================================================================
-- 5. ADD TERMS ACCEPTANCE TRACKING
-- ============================================================================
-- Track when users accepted terms of service

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20);

-- Set existing users as having accepted terms (grandfathered in)
UPDATE users
SET terms_accepted_at = created_at,
    terms_version = '1.0'
WHERE terms_accepted_at IS NULL;

-- ============================================================================
-- 6. ADD HELPFUL COMMENTS TO TABLES
-- ============================================================================
COMMENT ON TABLE users IS 'User accounts with authentication and profile data';
COMMENT ON TABLE referral_clicks IS 'Tracks each click on a user referral link for point attribution';
COMMENT ON TABLE prize_tiers IS 'Available prize tiers users can redeem points for';
COMMENT ON TABLE user_prize_claims IS 'Records of prize redemptions by users';
COMMENT ON TABLE episodes IS 'Podcast episodes available for referral sharing';
COMMENT ON TABLE video_metadata IS 'Cached metadata for YouTube/Spotify/Apple episodes';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this after migration to verify changes:
-- SELECT table_name, column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- ORDER BY table_name, ordinal_position;

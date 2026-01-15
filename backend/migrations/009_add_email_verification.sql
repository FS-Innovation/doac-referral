-- Migration: Add email verification fields
-- Date: 2026-01-14

-- Add email verification columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64),
ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMP;

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token) WHERE verification_token IS NOT NULL;

-- Update existing users: Mark as verified (grandfathered in) or leave unverified based on your preference
-- Option 1: Grandfather existing users as verified (uncomment if desired)
-- UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL OR email_verified = FALSE;

-- Option 2: Leave existing users unverified (they'll need to verify) - this is the default behavior
-- No action needed, defaults to FALSE

-- Migration: Update password_reset_tokens table for unique URL-based tokens
-- This migration updates the table to support URL-based reset links instead of 6-digit codes

-- Drop the existing password_reset_tokens table
DROP TABLE IF EXISTS password_reset_tokens CASCADE;

-- Create new password_reset_tokens table for URL-based reset links
-- Tokens are unique, hashed (SHA-256), and expire after 10 minutes
-- All previous tokens are invalidated when:
--   1. User requests a new reset link
--   2. User successfully resets their password
--   3. Token expires (10 minutes)
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  invalidated BOOLEAN DEFAULT FALSE,
  invalidated_at TIMESTAMP,
  invalidation_reason VARCHAR(50), -- 'new_request', 'password_reset', 'expired', 'manual'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX idx_password_reset_tokens_used ON password_reset_tokens(used);
CREATE INDEX idx_password_reset_tokens_invalidated ON password_reset_tokens(invalidated);

-- Add comment for documentation
COMMENT ON TABLE password_reset_tokens IS 'Stores hashed password reset tokens for secure URL-based password resets. Tokens expire after 10 minutes and are invalidated after use or when new token is requested.';

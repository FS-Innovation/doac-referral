-- Run this migration to update password_reset_tokens table
-- This converts the table from 6-digit codes to unique URL-based tokens

BEGIN;

-- Step 1: Drop existing table (this will delete all pending reset codes)
DROP TABLE IF EXISTS password_reset_tokens CASCADE;

-- Step 2: Create new table with URL-based token support
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

-- Step 3: Create indexes for performance
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX idx_password_reset_tokens_used ON password_reset_tokens(used);
CREATE INDEX idx_password_reset_tokens_invalidated ON password_reset_tokens(invalidated);

-- Step 4: Add table comment
COMMENT ON TABLE password_reset_tokens IS 'Stores hashed password reset tokens for secure URL-based password resets. Tokens expire after 10 minutes and are invalidated after use or when new token is requested.';

COMMIT;

-- Verify the migration
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'password_reset_tokens'
ORDER BY ordinal_position;

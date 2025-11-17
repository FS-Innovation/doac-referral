-- Migration: Add password reset tokens table
-- Date: 2025-01-17
-- Description: Adds secure password reset functionality with 6-digit codes

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(255) NOT NULL,
  device_fingerprint VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Add comment to table
COMMENT ON TABLE password_reset_tokens IS 'Stores hashed password reset codes with device fingerprinting for security';
COMMENT ON COLUMN password_reset_tokens.code_hash IS 'SHA-256 hash of the 6-digit reset code';
COMMENT ON COLUMN password_reset_tokens.device_fingerprint IS 'Device fingerprint to prevent code theft';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Code expires 10 minutes after creation';
COMMENT ON COLUMN password_reset_tokens.used IS 'Prevents code reuse - set to true after successful password reset or when new code is sent';

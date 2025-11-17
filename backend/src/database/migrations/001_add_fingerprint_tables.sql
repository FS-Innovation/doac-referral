-- Migration: Add user_fingerprints table and update referral_clicks
-- Date: 2025-11-17
-- Purpose: Fix critical security vulnerabilities - persistent fingerprint storage

-- 1. Add new columns to referral_clicks table
ALTER TABLE referral_clicks
ADD COLUMN IF NOT EXISTS device_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(255),
ADD COLUMN IF NOT EXISTS browser_fingerprint VARCHAR(255),
ADD COLUMN IF NOT EXISTS fraud_flags TEXT[],
ADD COLUMN IF NOT EXISTS points_awarded BOOLEAN DEFAULT TRUE;

-- 2. Create user_fingerprints table
CREATE TABLE IF NOT EXISTS user_fingerprints (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255),
  device_fingerprint VARCHAR(255),
  browser_fingerprint VARCHAR(255),
  ip_address VARCHAR(45),
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_fingerprints_user_id_device_id_key UNIQUE (user_id, device_id)
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_clicks_device_id ON referral_clicks(device_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_device_fingerprint ON referral_clicks(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_browser_fingerprint ON referral_clicks(browser_fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_fingerprints_user_id ON user_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fingerprints_device_id ON user_fingerprints(device_id);
CREATE INDEX IF NOT EXISTS idx_user_fingerprints_last_seen ON user_fingerprints(last_seen);

-- 4. Add comments for documentation
COMMENT ON TABLE user_fingerprints IS 'Persistent device/browser fingerprint storage for fraud prevention. Expires after 90 days of inactivity.';
COMMENT ON COLUMN referral_clicks.fraud_flags IS 'Array of fraud detection reasons (if any) - e.g., ["bot_detected", "high_velocity"]';
COMMENT ON COLUMN referral_clicks.points_awarded IS 'Whether points were actually awarded (false if fraud detected)';

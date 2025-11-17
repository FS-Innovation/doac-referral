-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  points INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referral clicks table (detailed tracking with full forensics)
CREATE TABLE IF NOT EXISTS referral_clicks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_id VARCHAR(255),
  device_fingerprint VARCHAR(255),
  browser_fingerprint VARCHAR(255),
  fraud_flags TEXT[],
  points_awarded BOOLEAN DEFAULT TRUE,
  clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User fingerprints table (persistent device tracking)
-- Tracks all devices/browsers a user has used for self-click prevention
-- Fingerprints expire after 90 days of inactivity (industry standard)
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

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  point_cost INTEGER NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  points_spent INTEGER NOT NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table (for global redirect URL)
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens table
-- Codes expire after 10 minutes
-- All previous codes are voided when a new code is sent
-- Codes are voided immediately when used
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

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_referral_clicks_user_id ON referral_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_device_id ON referral_clicks(device_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_device_fingerprint ON referral_clicks(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_browser_fingerprint ON referral_clicks(browser_fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_fingerprints_user_id ON user_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fingerprints_device_id ON user_fingerprints(device_id);
CREATE INDEX IF NOT EXISTS idx_user_fingerprints_last_seen ON user_fingerprints(last_seen);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

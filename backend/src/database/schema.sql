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
-- Tokens are unique URL-based links that expire after 10 minutes
-- All previous tokens are invalidated when:
--   1. User requests a new reset link
--   2. User successfully resets their password
--   3. Token expires (10 minutes)
-- Tokens are hashed (SHA-256) before storage for security
CREATE TABLE IF NOT EXISTS password_reset_tokens (
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
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used ON password_reset_tokens(used);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_invalidated ON password_reset_tokens(invalidated);

-- Prize tiers table
-- Defines the prize tiers and their point requirements
CREATE TABLE IF NOT EXISTS prize_tiers (
  id SERIAL PRIMARY KEY,
  tier_number INTEGER NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  prize_type VARCHAR(50) NOT NULL, -- 'discount_code', 'physical_product', 'mystery'
  discount_percentage INTEGER, -- For discount codes (10, 25, 50 etc)
  is_mystery BOOLEAN DEFAULT FALSE, -- Hidden prize (Tier 3)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prize codes table (single-use Shopify discount codes)
-- Stores pre-generated codes that get assigned to users when claimed
CREATE TABLE IF NOT EXISTS prize_codes (
  id SERIAL PRIMARY KEY,
  tier_id INTEGER REFERENCES prize_tiers(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL UNIQUE, -- The actual Shopify discount code
  claimed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMP,
  expires_at TIMESTAMP, -- Optional expiry date for the code
  is_used BOOLEAN DEFAULT FALSE, -- Tracks if code was actually used in Shopify
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User prize claims table (tracks what users have unlocked/claimed)
CREATE TABLE IF NOT EXISTS user_prize_claims (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tier_id INTEGER REFERENCES prize_tiers(id) ON DELETE CASCADE,
  prize_code_id INTEGER REFERENCES prize_codes(id) ON DELETE SET NULL,
  points_at_claim INTEGER NOT NULL, -- Points user had when claimed
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_tier UNIQUE (user_id, tier_id)
);

-- Indexes for prize tables
CREATE INDEX IF NOT EXISTS idx_prize_codes_tier_id ON prize_codes(tier_id);
CREATE INDEX IF NOT EXISTS idx_prize_codes_claimed_by ON prize_codes(claimed_by);
CREATE INDEX IF NOT EXISTS idx_user_prize_claims_user_id ON user_prize_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_user_prize_claims_tier_id ON user_prize_claims(tier_id);

-- Seed initial prize tiers
-- TIER 1: Discount codes (Shopify single-use codes)
-- TIER 2: Physical products
-- TIER 3: Mystery prize (hidden)
INSERT INTO prize_tiers (tier_number, name, description, points_required, prize_type, discount_percentage, is_mystery) VALUES
  -- TIER 1: Discount Codes
  (1, '10% Off', 'Get 10% off your next purchase', 1000, 'discount_code', 10, FALSE),
  (2, '25% Off', 'Get 25% off your next purchase', 2000, 'discount_code', 25, FALSE),
  (3, '50% Off', 'Get 50% off your next purchase', 3000, 'discount_code', 50, FALSE),
  -- TIER 2: Physical Products (4,000 points each)
  (4, 'Conversation Cards Vol. 1', 'The original DOAC Conversation Cards deck', 4000, 'physical_product', NULL, FALSE),
  (5, 'Conversation Cards Vol. 2', 'Deeper conversations, stronger connections', 4000, 'physical_product', NULL, FALSE),
  (6, 'Conversation Cards Vol. 3', 'The latest edition of our bestselling cards', 4000, 'physical_product', NULL, FALSE),
  (7, '1% Diary', 'The iconic DOAC diary', 5000, 'physical_product', NULL, FALSE),
  -- TIER 3: Mystery Prize (completely hidden)
  (8, '???', '???', 5000, 'mystery', NULL, TRUE)
ON CONFLICT (tier_number) DO NOTHING;

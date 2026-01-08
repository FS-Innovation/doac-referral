-- Prize tables migration
-- Run with: npx ts-node src/scripts/run-migration.ts migrations/006_create_prize_tables.sql

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
  reward_tier_code VARCHAR(50), -- Klaviyo reward tier code (PERKS10, PERKS25, etc)
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
  points_spent INTEGER NOT NULL, -- Points deducted for this redemption
  points_at_claim INTEGER NOT NULL, -- Points user had when claimed (before deduction)
  klaviyo_event_sent BOOLEAN DEFAULT FALSE, -- Track if Klaviyo event was sent
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_tier UNIQUE (user_id, tier_id)
);

-- Indexes for prize tables
CREATE INDEX IF NOT EXISTS idx_prize_codes_tier_id ON prize_codes(tier_id);
CREATE INDEX IF NOT EXISTS idx_prize_codes_claimed_by ON prize_codes(claimed_by);
CREATE INDEX IF NOT EXISTS idx_user_prize_claims_user_id ON user_prize_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_user_prize_claims_tier_id ON user_prize_claims(tier_id);

-- Seed initial prize tiers with Klaviyo reward tier codes
INSERT INTO prize_tiers (tier_number, name, description, points_required, prize_type, discount_percentage, reward_tier_code, is_mystery) VALUES
  -- TIER 1: Discount Codes
  (1, '10% Off', 'Get 10% off your next purchase', 1000, 'discount_code', 10, 'PERKS10', FALSE),
  (2, '25% Off', 'Get 25% off your next purchase', 2000, 'discount_code', 25, 'PERKS25', FALSE),
  (3, '50% Off', 'Get 50% off your next purchase', 3000, 'discount_code', 50, 'PERKS50', FALSE),
  -- TIER 2: Physical Products (4,000 points each)
  (4, 'Conversation Cards Vol. 1', 'The original DOAC Conversation Cards deck', 4000, 'physical_product', NULL, 'CONVO1', FALSE),
  (5, 'Conversation Cards Vol. 2', 'Deeper conversations, stronger connections', 4000, 'physical_product', NULL, 'CONVO2', FALSE),
  (6, 'Conversation Cards: Game Edition', 'The latest edition of our bestselling cards', 4000, 'physical_product', NULL, 'CONVOGE', FALSE),
  (7, '1% Diary', 'The iconic DOAC diary', 5000, 'physical_product', NULL, '1PERCENTDIARY', FALSE),
  -- TIER 3: Mystery Prize (completely hidden - points TBD, set high placeholder)
  (8, '???', '???', 999999, 'mystery', NULL, 'MYSTERY', TRUE)
ON CONFLICT (tier_number) DO UPDATE SET
  reward_tier_code = EXCLUDED.reward_tier_code,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  points_required = EXCLUDED.points_required;

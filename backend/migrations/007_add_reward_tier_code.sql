-- Migration: Add reward_tier_code column and update user_prize_claims table
-- Run against production Cloud SQL

-- 1. Add reward_tier_code column to prize_tiers (if not exists)
ALTER TABLE prize_tiers
ADD COLUMN IF NOT EXISTS reward_tier_code VARCHAR(50);

-- 2. Add points_spent and klaviyo_event_sent to user_prize_claims (if not exists)
ALTER TABLE user_prize_claims
ADD COLUMN IF NOT EXISTS points_spent INTEGER DEFAULT 0;

ALTER TABLE user_prize_claims
ADD COLUMN IF NOT EXISTS klaviyo_event_sent BOOLEAN DEFAULT FALSE;

-- 3. Update existing prize tiers with Klaviyo reward codes
UPDATE prize_tiers SET reward_tier_code = 'PERKS10' WHERE tier_number = 1;
UPDATE prize_tiers SET reward_tier_code = 'PERKS25' WHERE tier_number = 2;
UPDATE prize_tiers SET reward_tier_code = 'PERKS50' WHERE tier_number = 3;
UPDATE prize_tiers SET reward_tier_code = 'CONVO1' WHERE tier_number = 4;
UPDATE prize_tiers SET reward_tier_code = 'CONVO2' WHERE tier_number = 5;
UPDATE prize_tiers SET reward_tier_code = 'CONVOGE' WHERE tier_number = 6;
UPDATE prize_tiers SET reward_tier_code = '1PERCENTDIARY' WHERE tier_number = 7;
UPDATE prize_tiers SET reward_tier_code = 'MYSTERY' WHERE tier_number = 8;

-- 4. Update mystery prize points to placeholder (TBD)
UPDATE prize_tiers SET points_required = 999999 WHERE tier_number = 8;

-- 5. Update Vol. 3 name to Game Edition
UPDATE prize_tiers SET name = 'Conversation Cards: Game Edition' WHERE tier_number = 6;

-- Migration: Allow users to claim the same prize tier multiple times
-- Run with: npx ts-node src/scripts/run-migration.ts migrations/011_allow_multiple_prize_claims.sql
--
-- This removes the unique constraint that was preventing users from redeeming
-- the same prize multiple times (as long as they have enough points).

-- Drop the unique constraint on (user_id, tier_id)
ALTER TABLE user_prize_claims DROP CONSTRAINT IF EXISTS unique_user_tier;

-- Verify the change
-- Users can now claim the same tier multiple times, each claim is tracked separately

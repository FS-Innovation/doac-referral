-- Add Terms of Service acceptance tracking
-- LEGAL REQUIREMENT: Track when users accepted ToS for compliance/audit purposes

ALTER TABLE users
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20) DEFAULT '2026-01-14';

-- Add index for compliance audits (find users who accepted terms in date range)
CREATE INDEX IF NOT EXISTS idx_users_terms_accepted_at ON users(terms_accepted_at);

-- Add comments for documentation
COMMENT ON COLUMN users.terms_accepted_at IS 'Timestamp when user accepted Terms & Conditions - REQUIRED for legal compliance';
COMMENT ON COLUMN users.terms_version IS 'Version of ToS accepted (date-based versioning)';

-- Backfill existing users with their created_at date as terms_accepted_at
-- These users implicitly accepted terms when registering
UPDATE users
SET terms_accepted_at = created_at,
    terms_version = '2026-01-14'
WHERE terms_accepted_at IS NULL;

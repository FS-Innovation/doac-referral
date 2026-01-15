-- Add user profile fields for first-party data collection
-- Collects: first name, age range, country, marketing consent

ALTER TABLE users
ADD COLUMN IF NOT EXISTS first_name VARCHAR(50),
ADD COLUMN IF NOT EXISTS age_range VARCHAR(10),
ADD COLUMN IF NOT EXISTS country VARCHAR(2),
ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT FALSE;

-- Add index on country for geo-based queries and prize eligibility
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);

-- Add index on age_range for demographic analytics
CREATE INDEX IF NOT EXISTS idx_users_age_range ON users(age_range);

-- Add comments for documentation
COMMENT ON COLUMN users.first_name IS 'User first name for personalization and prize fulfillment';
COMMENT ON COLUMN users.age_range IS 'Age bracket: 18-24, 25-34, 35-44, 45-54, 55+';
COMMENT ON COLUMN users.country IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN users.marketing_consent IS 'GDPR-compliant marketing opt-in';

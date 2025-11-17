-- Migration: Fix user_fingerprints table schema
-- Date: 2025-11-17
-- Purpose: Rename last_ip to ip_address and add missing columns

-- 1. Rename last_ip to ip_address
ALTER TABLE user_fingerprints
RENAME COLUMN last_ip TO ip_address;

-- 2. Add missing columns if they don't exist
ALTER TABLE user_fingerprints
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 3. Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_fingerprints_user_id_device_id_key'
    ) THEN
        ALTER TABLE user_fingerprints
        ADD CONSTRAINT user_fingerprints_user_id_device_id_key UNIQUE (user_id, device_id);
    END IF;
END $$;

-- 4. Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_fingerprints_user_id ON user_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fingerprints_device_id ON user_fingerprints(device_id);
CREATE INDEX IF NOT EXISTS idx_user_fingerprints_last_seen ON user_fingerprints(last_seen);

-- 5. Verify the schema
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_fingerprints'
ORDER BY ordinal_position;

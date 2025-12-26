-- Add key_type column to distinguish secret vs publishable keys
-- Existing keys default to 'secret' for backward compatibility
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS key_type VARCHAR(20) DEFAULT 'secret' 
CHECK (key_type IN ('secret', 'publishable'));

-- Add allowed_domains column for domain whitelisting (publishable keys only)
-- Stores array of allowed domain patterns (e.g., 'example.com', '*.example.com')
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS allowed_domains TEXT[] DEFAULT NULL;

-- Migrate all existing keys to 'secret' type
UPDATE api_keys SET key_type = 'secret' WHERE key_type IS NULL;

-- Add index for key_type lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_key_type ON api_keys(key_type);

-- Add comment for documentation
COMMENT ON COLUMN api_keys.key_type IS 'Type of API key: secret (backend only) or publishable (browser-safe with domain restrictions)';
COMMENT ON COLUMN api_keys.allowed_domains IS 'Array of allowed domains for publishable keys. Supports wildcards like *.example.com';

-- Add environment column to api_keys table
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'test'));

-- Create index for environment filtering
CREATE INDEX IF NOT EXISTS idx_api_keys_environment ON api_keys(environment);

-- Update comment
COMMENT ON COLUMN api_keys.environment IS 'The environment this key belongs to (production or test)';

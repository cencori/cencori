-- API Keys Table for Supabase
-- Execute this script in your Supabase SQL Editor

-- Create the api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at ON api_keys(revoked_at);

-- Add Row Level Security (RLS) policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view API keys for projects in their organizations
CREATE POLICY "Users can view api_keys for their org projects"
ON api_keys FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    INNER JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = api_keys.project_id
    AND o.owner_id = auth.uid()
  )
);

-- Policy: Users can insert API keys for projects in their organizations
CREATE POLICY "Users can create api_keys for their org projects"
ON api_keys FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    INNER JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = api_keys.project_id
    AND o.owner_id = auth.uid()
  )
);

-- Policy: Users can update (revoke) API keys for projects in their organizations
CREATE POLICY "Users can update api_keys for their org projects"
ON api_keys FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    INNER JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = api_keys.project_id
    AND o.owner_id = auth.uid()
  )
);

-- Policy: Users can delete API keys for projects in their organizations
CREATE POLICY "Users can delete api_keys for their org projects"
ON api_keys FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    INNER JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = api_keys.project_id
    AND o.owner_id = auth.uid()
  )
);

-- Add comments for documentation
COMMENT ON TABLE api_keys IS 'Stores API keys for project authentication';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 characters of the key for identification (e.g., cen_abcd)';
COMMENT ON COLUMN api_keys.key_hash IS 'Bcrypt hash of the full API key';
COMMENT ON COLUMN api_keys.last_used_at IS 'Timestamp of when the key was last used';
COMMENT ON COLUMN api_keys.revoked_at IS 'Timestamp of when the key was revoked (soft delete)';

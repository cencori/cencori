-- =====================================================
-- API Keys Table Schema for Supabase
-- =====================================================
-- This script creates the api_keys table with proper
-- indexes and Row Level Security (RLS) policies.
-- 
-- Run this in your Supabase SQL Editor to set up the
-- API keys feature.
-- =====================================================

-- Create the api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL, -- First 8 characters for display
    key_hash TEXT NOT NULL UNIQUE, -- Hashed API key for verification
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by);

-- Enable Row Level Security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view API keys for projects in organizations they own
CREATE POLICY "Users can view their organization's API keys"
    ON api_keys
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM projects p
            INNER JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = api_keys.project_id
            AND o.owner_id = auth.uid()
        )
    );

-- RLS Policy: Users can create API keys for projects in organizations they own
CREATE POLICY "Users can create API keys for their organization's projects"
    ON api_keys
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM projects p
            INNER JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = api_keys.project_id
            AND o.owner_id = auth.uid()
        )
    );

-- RLS Policy: Users can update (revoke) API keys for projects in organizations they own
CREATE POLICY "Users can update their organization's API keys"
    ON api_keys
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM projects p
            INNER JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = api_keys.project_id
            AND o.owner_id = auth.uid()
        )
    );

-- RLS Policy: Users can delete API keys for projects in organizations they own
CREATE POLICY "Users can delete their organization's API keys"
    ON api_keys
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM projects p
            INNER JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = api_keys.project_id
            AND o.owner_id = auth.uid()
        )
    );

-- Add comment to the table
COMMENT ON TABLE api_keys IS 'Stores API keys for project authentication';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 characters of the key for display purposes (e.g., cen_12345678)';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the full API key for secure verification';
COMMENT ON COLUMN api_keys.last_used_at IS 'Timestamp of when the API key was last used (updated on API calls)';
COMMENT ON COLUMN api_keys.revoked_at IS 'Timestamp when the key was revoked (soft delete)';

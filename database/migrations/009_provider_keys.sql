-- Migration: Provider Keys (BYOK)
-- Allows users to store their own provider API keys for routing through Cencori

-- Create provider_keys table for encrypted storage
CREATE TABLE IF NOT EXISTS provider_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN (
        'openai', 'anthropic', 'google', 'mistral', 'groq', 
        'cohere', 'together', 'perplexity', 'openrouter', 'xai',
        'meta', 'huggingface', 'qwen', 'deepseek'
    )),
    encrypted_key TEXT NOT NULL,
    key_hint TEXT, -- Last 4 characters for display (e.g., "...Qx4F")
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One key per provider per project
    UNIQUE(project_id, provider)
);

-- Add default provider/model columns to projects table
ALTER TABLE projects 
    ADD COLUMN IF NOT EXISTS default_provider TEXT DEFAULT 'openai',
    ADD COLUMN IF NOT EXISTS default_model TEXT DEFAULT 'gpt-4o';

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_provider_keys_project_id ON provider_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_provider_keys_provider ON provider_keys(provider);

-- Enable RLS
ALTER TABLE provider_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only org members can manage provider keys
CREATE POLICY "Org members can view provider keys"
    ON provider_keys FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE p.id = provider_keys.project_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Org admins can insert provider keys"
    ON provider_keys FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE p.id = provider_keys.project_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Org admins can update provider keys"
    ON provider_keys FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE p.id = provider_keys.project_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Org admins can delete provider keys"
    ON provider_keys FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE p.id = provider_keys.project_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_provider_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER provider_keys_updated_at
    BEFORE UPDATE ON provider_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_provider_keys_updated_at();

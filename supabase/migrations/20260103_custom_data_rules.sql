-- Custom Data Rules Migration
-- Run this in Supabase SQL Editor

-- Create custom_data_rules table
CREATE TABLE IF NOT EXISTS custom_data_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Rule definition
    name TEXT NOT NULL,
    description TEXT,
    
    -- Matching
    match_type TEXT NOT NULL CHECK (match_type IN ('keywords', 'regex', 'json_path', 'ai_detect')),
    pattern TEXT NOT NULL,
    case_sensitive BOOLEAN DEFAULT FALSE,
    
    -- Action when matched
    action TEXT NOT NULL CHECK (action IN ('mask', 'redact', 'block')),
    
    -- Config
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_custom_data_rules_project ON custom_data_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_custom_data_rules_active ON custom_data_rules(project_id, is_active) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE custom_data_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view custom_data_rules for their projects" ON custom_data_rules
    FOR SELECT
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN organizations o ON p.organization_id = o.id
            JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert custom_data_rules for their projects" ON custom_data_rules
    FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN organizations o ON p.organization_id = o.id
            JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update custom_data_rules for their projects" ON custom_data_rules
    FOR UPDATE
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN organizations o ON p.organization_id = o.id
            JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete custom_data_rules for their projects" ON custom_data_rules
    FOR DELETE
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN organizations o ON p.organization_id = o.id
            JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_custom_data_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_custom_data_rules_timestamp
    BEFORE UPDATE ON custom_data_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_data_rules_timestamp();

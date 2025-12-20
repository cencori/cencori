-- =====================================================
-- Webhooks Table Schema for Supabase
-- =====================================================
-- This script creates the webhooks table for project
-- webhook integrations with proper RLS policies.
--
-- Run this in your Supabase SQL Editor.
-- =====================================================

-- Create the webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT ARRAY['request.completed'],
    secret TEXT, -- Optional webhook secret for HMAC signature verification
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT -- Last error message if delivery failed
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webhooks_project_id ON webhooks(project_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON webhooks(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view webhooks for projects in organizations they own
CREATE POLICY "Users can view their organization's webhooks"
    ON webhooks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM projects p
            INNER JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = webhooks.project_id
            AND o.owner_id = auth.uid()
        )
    );

-- RLS Policy: Users can create webhooks for projects in organizations they own
CREATE POLICY "Users can create webhooks for their organization's projects"
    ON webhooks
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM projects p
            INNER JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = webhooks.project_id
            AND o.owner_id = auth.uid()
        )
    );

-- RLS Policy: Users can update webhooks for projects in organizations they own
CREATE POLICY "Users can update their organization's webhooks"
    ON webhooks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM projects p
            INNER JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = webhooks.project_id
            AND o.owner_id = auth.uid()
        )
    );

-- RLS Policy: Users can delete webhooks for projects in organizations they own
CREATE POLICY "Users can delete their organization's webhooks"
    ON webhooks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM projects p
            INNER JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = webhooks.project_id
            AND o.owner_id = auth.uid()
        )
    );

-- Add comments
COMMENT ON TABLE webhooks IS 'Stores webhook configurations for project event notifications';
COMMENT ON COLUMN webhooks.events IS 'Array of event types: request.completed, request.failed, security.violation, rate_limit.exceeded, cost.threshold, model.fallback';
COMMENT ON COLUMN webhooks.secret IS 'Optional secret for HMAC-SHA256 signature verification (X-Webhook-Signature header)';
COMMENT ON COLUMN webhooks.failure_count IS 'Consecutive failure count (resets on successful delivery)';

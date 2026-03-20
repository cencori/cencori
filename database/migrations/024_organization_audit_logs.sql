-- Organization-level audit logs
-- Captures every administrative mutation across all projects in an org

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    -- Event classification
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,

    -- Actor
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    actor_ip TEXT,
    actor_type TEXT NOT NULL DEFAULT 'user',

    -- Human-readable summary
    description TEXT NOT NULL,

    -- Structured details (before/after values, metadata)
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary query: org timeline     
CREATE INDEX idx_audit_logs_org_time ON audit_logs(organization_id, created_at DESC);

-- Filtered by category
CREATE INDEX idx_audit_logs_org_category ON audit_logs(organization_id, category, created_at DESC);

-- Filtered by actor
CREATE INDEX idx_audit_logs_org_actor ON audit_logs(organization_id, actor_id, created_at DESC);

-- Project-scoped view
CREATE INDEX idx_audit_logs_project ON audit_logs(project_id, created_at DESC);

-- Retention cleanup
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- JSONB search
CREATE INDEX idx_audit_logs_metadata ON audit_logs USING GIN (metadata);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only org admins/owners can read audit logs
CREATE POLICY "Org admins can read audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.organization_id = audit_logs.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
);

-- Only service role can insert (server-side writeAuditLog helper)
CREATE POLICY "Service role can insert audit logs"
ON audit_logs FOR INSERT
TO service_role
WITH CHECK (true);

-- Backfill script is in 025_audit_logs_backfill.sql (run separately after table is created)

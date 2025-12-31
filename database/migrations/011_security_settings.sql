-- Security Settings Table
-- Stores per-project security configuration settings

CREATE TABLE IF NOT EXISTS security_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Content filtering toggles
    filter_harmful_content BOOLEAN DEFAULT true,
    filter_pii BOOLEAN DEFAULT true,
    filter_nsfw BOOLEAN DEFAULT true,
    filter_jailbreaks BOOLEAN DEFAULT true,
    filter_prompt_injection BOOLEAN DEFAULT true,
    
    -- Safety threshold (0.0 to 1.0, higher = stricter)
    safety_threshold DECIMAL(3,2) DEFAULT 0.7 CHECK (safety_threshold >= 0 AND safety_threshold <= 1),
    
    -- IP allowlist (null = allow all)
    ip_allowlist TEXT[] DEFAULT NULL,
    
    -- Audit logging
    audit_logging_enabled BOOLEAN DEFAULT true,
    
    -- Webhook for security alerts
    alert_webhook_url TEXT,
    alert_on_critical BOOLEAN DEFAULT true,
    alert_on_high BOOLEAN DEFAULT true,
    alert_on_medium BOOLEAN DEFAULT false,
    alert_on_low BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Security audit log
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Event details
    event_type TEXT NOT NULL CHECK (event_type IN (
        'settings_updated',
        'api_key_created',
        'api_key_deleted',
        'api_key_rotated',
        'webhook_created',
        'webhook_deleted',
        'incident_reviewed',
        'ip_blocked',
        'rate_limit_exceeded',
        'auth_failed'
    )),
    
    -- Actor
    actor_id UUID REFERENCES auth.users(id),
    actor_email TEXT,
    actor_ip TEXT,
    
    -- Details
    details JSONB DEFAULT '{}',
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_settings_project_id ON security_settings(project_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_project_id ON security_audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON security_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security_settings
CREATE POLICY "Users can view security settings for their projects"
ON security_settings FOR SELECT
USING (
    project_id IN (
        SELECT p.id FROM projects p
        INNER JOIN organizations o ON p.organization_id = o.id
        WHERE o.owner_id = auth.uid()
    )
);

CREATE POLICY "Users can update security settings for their projects"
ON security_settings FOR UPDATE
USING (
    project_id IN (
        SELECT p.id FROM projects p
        INNER JOIN organizations o ON p.organization_id = o.id
        WHERE o.owner_id = auth.uid()
    )
);

CREATE POLICY "Users can insert security settings for their projects"
ON security_settings FOR INSERT
WITH CHECK (
    project_id IN (
        SELECT p.id FROM projects p
        INNER JOIN organizations o ON p.organization_id = o.id
        WHERE o.owner_id = auth.uid()
    )
);

-- RLS Policies for security_audit_log
CREATE POLICY "Users can view audit logs for their projects"
ON security_audit_log FOR SELECT
USING (
    project_id IN (
        SELECT p.id FROM projects p
        INNER JOIN organizations o ON p.organization_id = o.id
        WHERE o.owner_id = auth.uid()
    )
);

CREATE POLICY "Service role can insert audit logs"
ON security_audit_log FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_security_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_security_settings_timestamp
BEFORE UPDATE ON security_settings
FOR EACH ROW
EXECUTE FUNCTION update_security_settings_timestamp();

-- Comments
COMMENT ON TABLE security_settings IS 'Per-project security configuration settings';
COMMENT ON TABLE security_audit_log IS 'Audit trail for all security-related events';
COMMENT ON COLUMN security_settings.safety_threshold IS 'Content safety threshold (0.0 lenient to 1.0 strict)';
COMMENT ON COLUMN security_settings.ip_allowlist IS 'Array of allowed IP addresses (null = allow all)';

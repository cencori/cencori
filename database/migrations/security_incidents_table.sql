-- Security Incidents Table
-- Tracks all security violations and blocked content for compliance and analysis

CREATE TABLE IF NOT EXISTS security_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    ai_request_id UUID REFERENCES ai_requests(id) ON DELETE SET NULL,
    
    -- Incident classification
    incident_type TEXT NOT NULL CHECK (incident_type IN (
        'jailbreak',
        'pii_input',
        'pii_output',
        'harmful_content',
        'instruction_leakage',
        'prompt_injection',
        'multi_vector'
    )),
    
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    blocked_at TEXT NOT NULL CHECK (blocked_at IN ('input', 'output', 'both')),
    detection_method TEXT NOT NULL, -- e.g., 'pattern_matching', 'intent_analysis', 'context_aware'
    
    -- Risk metrics
    risk_score DECIMAL(3,2) CHECK (risk_score >= 0 AND risk_score <= 1),
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Detailed information (JSONB for flexibility)
    details JSONB DEFAULT '{}',
    -- Example details structure:
    -- {
    --   "patterns_detected": ["social_engineering", "indirect_pii"],
    --   "blocked_content": {"type": "email", "examples": ["john.smith@company.org"]},
    --   "reasons": ["Output teaches PII exfiltration techniques"],
    --   "input_preview": "How to share...",
    --   "output_preview": "Here are 5 ways..."
    -- }
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id),
    notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_incidents_project_id ON security_incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_ai_request_id ON security_incidents(ai_request_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_incident_type ON security_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_created_at ON security_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_incidents_reviewed ON security_incidents(reviewed) WHERE NOT reviewed;

-- RLS Policies
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view security incidents for their own projects
CREATE POLICY "Users can view security incidents for their projects"
ON security_incidents
FOR SELECT
USING (
    project_id IN (
        SELECT p.id FROM projects p
        INNER JOIN organizations o ON p.organization_id = o.id
        WHERE o.owner_id = auth.uid()
    )
);

-- Policy: Service role can insert security incidents
CREATE POLICY "Service role can insert security incidents"
ON security_incidents
FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Users can update (review) security incidents for their projects
CREATE POLICY "Users can update security incidents for their projects"
ON security_incidents
FOR UPDATE
USING (
    project_id IN (
        SELECT p.id FROM projects p
        INNER JOIN organizations o ON p.organization_id = o.id
        WHERE o.owner_id = auth.uid()
    )
);

-- Add a trigger to automatically set severity based on risk score
CREATE OR REPLACE FUNCTION set_incident_severity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.risk_score >= 0.8 THEN
        NEW.severity := 'critical';
    ELSIF NEW.risk_score >= 0.6 THEN
        NEW.severity := 'high';
    ELSIF NEW.risk_score >= 0.4 THEN
        NEW.severity := 'medium';
    ELSE
        NEW.severity := 'low';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_incident_severity
BEFORE INSERT ON security_incidents
FOR EACH ROW
EXECUTE FUNCTION set_incident_severity();

-- Add helpful comments
COMMENT ON TABLE security_incidents IS 'Tracks all security violations and blocked content for compliance and threat analysis';
COMMENT ON COLUMN security_incidents.incident_type IS 'Type of security incident detected';
COMMENT ON COLUMN security_incidents.severity IS 'Auto-calculated from risk_score, can be manually overridden';
COMMENT ON COLUMN security_incidents.blocked_at IS 'Whether content was blocked at input or output phase';
COMMENT ON COLUMN security_incidents.details IS 'JSONB field containing detailed incident information';

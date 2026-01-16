-- Migration: Project Budgets and Spend Caps
-- Adds budget alerts and spend cap functionality to projects

-- Add budget and spend cap columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS monthly_budget DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_alerts_enabled BOOLEAN DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_budget_alert_percent INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS spend_cap DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS enforce_spend_cap BOOLEAN DEFAULT false;

-- Create budget_alerts table to track sent alerts
CREATE TABLE IF NOT EXISTS budget_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    threshold_percent INTEGER NOT NULL, -- 50, 80, or 100
    current_spend DECIMAL(10,2) NOT NULL,
    budget_amount DECIMAL(10,2) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    sent_to TEXT[] NOT NULL, -- Array of email addresses
    UNIQUE(project_id, threshold_percent, period_start)
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_budget_alerts_project_period 
    ON budget_alerts(project_id, period_start);

-- Function to get current month spend for a project
CREATE OR REPLACE FUNCTION get_current_month_spend(p_project_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    total_spend DECIMAL(10,2);
BEGIN
    SELECT COALESCE(SUM(cost), 0)
    INTO total_spend
    FROM ai_requests
    WHERE project_id = p_project_id
      AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
      AND created_at < date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month';
    
    RETURN total_spend;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on budget_alerts
ALTER TABLE budget_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view alerts for projects they have access to
CREATE POLICY "Users can view budget alerts for their projects" ON budget_alerts
    FOR SELECT
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

-- Policy: Only system can insert alerts (via service role)
CREATE POLICY "Service role can insert budget alerts" ON budget_alerts
    FOR INSERT
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON budget_alerts TO authenticated;
GRANT ALL ON budget_alerts TO service_role;

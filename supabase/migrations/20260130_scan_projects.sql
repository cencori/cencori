-- Scan projects table for the scan.cencori.com dashboard
-- Stores imported GitHub repositories for security scanning

CREATE TABLE IF NOT EXISTS scan_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Owner (user who imported the project)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- GitHub repository info
    github_repo_id BIGINT NOT NULL,
    github_repo_full_name TEXT NOT NULL,
    github_repo_url TEXT NOT NULL,
    github_repo_description TEXT,
    github_installation_id BIGINT NOT NULL,
    
    -- Scan status
    last_scan_at TIMESTAMPTZ,
    last_scan_score TEXT,
    last_scan_issues INTEGER DEFAULT 0,
    last_scan_files INTEGER DEFAULT 0,
    
    -- Settings
    auto_scan_enabled BOOLEAN DEFAULT TRUE,
    slack_webhook_url TEXT,
    discord_webhook_url TEXT,
    
    -- Constraints
    UNIQUE(user_id, github_repo_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scan_projects_user_id 
ON scan_projects(user_id);

CREATE INDEX IF NOT EXISTS idx_scan_projects_github_repo_id 
ON scan_projects(github_repo_id);

CREATE INDEX IF NOT EXISTS idx_scan_projects_last_scan 
ON scan_projects(last_scan_at DESC);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_scan_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_scan_projects_updated_at
BEFORE UPDATE ON scan_projects
FOR EACH ROW
EXECUTE FUNCTION update_scan_projects_updated_at();

-- Enable RLS
ALTER TABLE scan_projects ENABLE ROW LEVEL SECURITY;

-- Users can only see their own projects
CREATE POLICY "Users can view own scan projects"
ON scan_projects FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own projects
CREATE POLICY "Users can insert own scan projects"
ON scan_projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update own scan projects"
ON scan_projects FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own scan projects"
ON scan_projects FOR DELETE
USING (auth.uid() = user_id);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access to scan projects"
ON scan_projects FOR ALL
USING (auth.role() = 'service_role');


-- Scan runs table for tracking scan history
CREATE TABLE IF NOT EXISTS scan_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Link to project
    project_id UUID NOT NULL REFERENCES scan_projects(id) ON DELETE CASCADE,
    
    -- Scan results
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    score TEXT,
    files_scanned INTEGER DEFAULT 0,
    issues_found INTEGER DEFAULT 0,
    scan_duration_ms INTEGER DEFAULT 0,
    
    -- Issue breakdown
    secrets_count INTEGER DEFAULT 0,
    pii_count INTEGER DEFAULT 0,
    vulnerabilities_count INTEGER DEFAULT 0,
    
    -- Raw results (JSON blob)
    results JSONB,
    
    -- Error info if failed
    error_message TEXT
);

-- Index for project scan history
CREATE INDEX IF NOT EXISTS idx_scan_runs_project_id 
ON scan_runs(project_id, created_at DESC);

-- Enable RLS
ALTER TABLE scan_runs ENABLE ROW LEVEL SECURITY;

-- Users can view scans for their own projects
CREATE POLICY "Users can view own scan runs"
ON scan_runs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM scan_projects 
        WHERE scan_projects.id = scan_runs.project_id 
        AND scan_projects.user_id = auth.uid()
    )
);

-- Service role can do everything
CREATE POLICY "Service role full access to scan runs"
ON scan_runs FOR ALL
USING (auth.role() = 'service_role');

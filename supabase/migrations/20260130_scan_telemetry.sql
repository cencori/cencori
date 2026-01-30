-- Scan telemetry table for tracking @cencori/scan usage metrics
-- Stores anonymous usage data for both authenticated and non-authenticated users

CREATE TABLE IF NOT EXISTS scan_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Event metadata
    event TEXT NOT NULL DEFAULT 'scan_completed',
    version TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'unknown',
    
    -- Scan metrics
    files_scanned INTEGER NOT NULL DEFAULT 0,
    issues_found INTEGER NOT NULL DEFAULT 0,
    score TEXT NOT NULL DEFAULT 'unknown',
    scan_duration_ms INTEGER NOT NULL DEFAULT 0,
    
    -- User context
    has_api_key BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Issue breakdown
    secrets_count INTEGER NOT NULL DEFAULT 0,
    pii_count INTEGER NOT NULL DEFAULT 0,
    routes_count INTEGER NOT NULL DEFAULT 0,
    config_count INTEGER NOT NULL DEFAULT 0,
    vulnerabilities_count INTEGER NOT NULL DEFAULT 0
);

-- Index for time-based queries (daily/weekly reports)
CREATE INDEX IF NOT EXISTS idx_scan_telemetry_created_at 
ON scan_telemetry(created_at DESC);

-- Index for authenticated vs anonymous queries
CREATE INDEX IF NOT EXISTS idx_scan_telemetry_has_api_key 
ON scan_telemetry(has_api_key);

-- Composite index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_scan_telemetry_dashboard 
ON scan_telemetry(created_at DESC, has_api_key, score);

-- Enable RLS but allow inserts without auth (for anonymous telemetry)
ALTER TABLE scan_telemetry ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert telemetry (no auth required)
CREATE POLICY "Allow anonymous telemetry inserts"
ON scan_telemetry FOR INSERT
WITH CHECK (true);

-- Only service role can read telemetry (for dashboard)
CREATE POLICY "Service role can read telemetry"
ON scan_telemetry FOR SELECT
USING (auth.role() = 'service_role');

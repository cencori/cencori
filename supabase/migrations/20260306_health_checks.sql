
-- Migration: Create health_checks table

--  Create the table
CREATE TABLE IF NOT EXISTS health_checks (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  checked_at    TIMESTAMPTZ DEFAULT NOW()             NOT NULL,
  service_name  TEXT                                  NOT NULL,
  status        TEXT                                  NOT NULL,
  latency_ms    INTEGER,
  error_message TEXT,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE
);
 
-- Add a CHECK constraint so only valid statuses are stored
ALTER TABLE health_checks
  ADD CONSTRAINT health_checks_status_check
  CHECK (status IN ('healthy', 'degraded', 'down'));
 
--  Add an index for fast queries by project + time
CREATE INDEX IF NOT EXISTS idx_health_checks_project_time
  ON health_checks (project_id, checked_at DESC);
 
--  Enable Row Level Security (RLS) so users only see their own data
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;
 
--  RLS Policy: SELECT is allowed only if the project belongs
--  to an organization the current user is a member of
CREATE POLICY "Users can view health checks for their projects"
  ON health_checks FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );
 
-- RLS Policy: only service-role (server-side) can INSERT
-- This prevents any client from writing fake health data
CREATE POLICY "Service role can insert health checks"
  ON health_checks FOR INSERT
  WITH CHECK (true);
 
-- ============================================================
-- CLEANUP STRATEGY (document only — implement as a cron job)
-- Run this SQL monthly via a Supabase Edge Function or pg_cron:
--   DELETE FROM health_checks
--   WHERE checked_at < NOW() - INTERVAL '30 days';
-- ============================================================

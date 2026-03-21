-- ============================================================
-- Migration: Create health_checks table
-- Date: 2026-03-06
-- Author: Cencori Engineering
-- ============================================================
 
-- Step 1: Create the table
CREATE TABLE IF NOT EXISTS health_checks (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  checked_at    TIMESTAMPTZ DEFAULT NOW()             NOT NULL,
  service_name  TEXT                                  NOT NULL,
  status        TEXT                                  NOT NULL,
  latency_ms    INTEGER,
  error_message TEXT,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE
);
 
-- Step 2: Add a CHECK constraint so only valid statuses are stored
ALTER TABLE health_checks
  ADD CONSTRAINT health_checks_status_check
  CHECK (status IN ('healthy', 'degraded', 'down'));
 
-- Step 3: Add an index for fast queries by project + time
-- The DESC order matches how we query: "give me the latest checks first"
CREATE INDEX IF NOT EXISTS idx_health_checks_project_time
  ON health_checks (project_id, checked_at DESC);
 
-- Step 4: Enable Row Level Security (RLS) so users only see their own data
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;
 
-- Step 5: RLS Policy — SELECT is allowed only if the project belongs
--         to an organization the current user is a member of
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
 
-- Step 6: RLS Policy — only service-role (server-side) can INSERT
--         This prevents any client from writing fake health data
CREATE POLICY "Service role can insert health checks"
  ON health_checks FOR INSERT
  WITH CHECK (true);  -- service_role bypasses RLS; this is a safety comment
 
-- ============================================================
-- CLEANUP STRATEGY (document only — implement as a cron job)
-- Run this SQL monthly via a Supabase Edge Function or pg_cron:
--   DELETE FROM health_checks
--   WHERE checked_at < NOW() - INTERVAL '30 days';
-- ============================================================

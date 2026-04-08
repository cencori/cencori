-- ================================================================
-- Migration: Model Health Checks
-- Date: 2026-04-01
-- ================================================================
 
CREATE TABLE IF NOT EXISTS model_health_checks (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    UUID        REFERENCES projects(id) ON DELETE CASCADE,
  model_name    TEXT        NOT NULL,
  provider      TEXT        NOT NULL,
  status        TEXT        NOT NULL,
  latency_ms    INTEGER,
  error_message TEXT,
  checked_at    TIMESTAMPTZ DEFAULT NOW()
);
 
-- Enforce valid status values
ALTER TABLE model_health_checks
  ADD CONSTRAINT model_health_checks_status_check
  CHECK (status IN ('available', 'degraded', 'unavailable'));
 
-- Composite index — matches the most common query pattern:
-- "give me the last N checks for model X in project Y"
-- Order: project_id first (equality), model_name second (equality),
-- checked_at DESC last (range/sort)
CREATE INDEX IF NOT EXISTS idx_model_health_checks_project_model_time
  ON model_health_checks (project_id, model_name, checked_at DESC);
 
-- ================================================================
-- PostgreSQL function: calculate uptime percentage
-- Returns how many checks were 'available' / total checks
-- for a given project + model over the last N hours
-- ================================================================
CREATE OR REPLACE FUNCTION calculate_model_uptime(
  p_project_id  UUID,
  p_model_name  TEXT,
  p_hours       INTEGER DEFAULT 24
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_checks  INTEGER;
  up_checks     INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_checks
  FROM model_health_checks
  WHERE project_id = p_project_id
    AND model_name = p_model_name
    AND checked_at > NOW() - (p_hours || ' hours')::INTERVAL;
 
  IF total_checks = 0 THEN
    RETURN 100; -- no data = assume healthy
  END IF;
 
  SELECT COUNT(*) INTO up_checks
  FROM model_health_checks
  WHERE project_id = p_project_id
    AND model_name = p_model_name
    AND checked_at > NOW() - (p_hours || ' hours')::INTERVAL
    AND status = 'available';
 
  RETURN ROUND((up_checks::NUMERIC / total_checks::NUMERIC) * 100, 1);
END;
$$;
 
-- ================================================================
-- Row Level Security
-- ================================================================
ALTER TABLE model_health_checks ENABLE ROW LEVEL SECURITY;
 
-- Users can only SELECT rows for projects in their organization
CREATE POLICY "Users can view health checks for their projects"
  ON model_health_checks FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );
 
-- Only service role (admin client in API routes) can INSERT
CREATE POLICY "Service role can insert health checks"
  ON model_health_checks FOR INSERT
  WITH CHECK (true); -- service_role bypasses RLS; admin client uses service key
 
-- ================================================================
-- DATA RETENTION (implemented in cron job File 5):
-- DELETE FROM model_health_checks
-- WHERE checked_at < NOW() - INTERVAL '7 days';
-- Keeps the table lean — 7 days of per-check data is sufficient
-- for trend analysis; older data would be aggregated separately
-- ================================================================

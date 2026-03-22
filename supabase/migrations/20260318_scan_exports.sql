-- ================================================================
-- Migration: Scan Exports tracking table
-- Date: 2026-03-18
-- ================================================================
 
CREATE TABLE IF NOT EXISTS scan_exports (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id       UUID        REFERENCES projects(id)   ON DELETE CASCADE,
  user_id          UUID        REFERENCES auth.users(id),
  format           TEXT        NOT NULL,
  finding_count    INTEGER     NOT NULL DEFAULT 0,
  file_size_bytes  INTEGER,
  status           TEXT        NOT NULL DEFAULT 'pending',
  error_message    TEXT,
  download_url     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);
 
-- Enforce valid format values
ALTER TABLE scan_exports
  ADD CONSTRAINT scan_exports_format_check
  CHECK (format IN ('csv', 'json', 'pdf'));
 
-- Enforce valid status values
ALTER TABLE scan_exports
  ADD CONSTRAINT scan_exports_status_check
  CHECK (status IN ('pending', 'generating', 'completed', 'failed'));
 
-- Index for fast "all exports for this project" queries
CREATE INDEX IF NOT EXISTS idx_scan_exports_project_date
  ON scan_exports (project_id, created_at DESC);
 
-- Enable Row Level Security
ALTER TABLE scan_exports ENABLE ROW LEVEL SECURITY;
 
-- Users can only see their own exports
CREATE POLICY "Users can view their own exports"
  ON scan_exports FOR SELECT
  USING (user_id = auth.uid());
 
-- Users can only create exports for projects in their organization
CREATE POLICY "Users can create exports for their projects"
  ON scan_exports FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );
 
-- Service role (server-side) can update status and download_url
CREATE POLICY "Service role can update exports"
  ON scan_exports FOR UPDATE
  USING (true);
 
-- ================================================================
-- CLEANUP STRATEGY (implemented in app/api/cron/cleanup-exports):
-- DELETE FROM scan_exports WHERE created_at < NOW() - INTERVAL '90 days';
-- ================================================================

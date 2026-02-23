-- Persist fix workflow state per scan run so web UI can support
-- suggest/dismiss/PR/done lifecycle.

ALTER TABLE scan_runs
    ADD COLUMN IF NOT EXISTS fix_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS fix_dismissed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS fix_pr_url TEXT,
    ADD COLUMN IF NOT EXISTS fix_pr_number INTEGER,
    ADD COLUMN IF NOT EXISTS fix_branch_name TEXT,
    ADD COLUMN IF NOT EXISTS fix_done_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'scan_runs_fix_status_check'
    ) THEN
        ALTER TABLE scan_runs
            ADD CONSTRAINT scan_runs_fix_status_check
            CHECK (
                fix_status IN ('pending', 'dismissed', 'pr_opened', 'done', 'not_applicable')
            );
    END IF;
END $$;

-- Existing scans with no issues do not need a fix workflow.
UPDATE scan_runs
SET fix_status = 'not_applicable'
WHERE issues_found = 0
  AND fix_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scan_runs_fix_status
    ON scan_runs(project_id, fix_status, created_at DESC);


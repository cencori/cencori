-- A short note saying what changed, written when a version is published from
-- the dashboard's Review changes dialog (like a commit message). Optional:
-- versions published through the API or before this column existed have none.

ALTER TABLE public.agent_versions
    ADD COLUMN IF NOT EXISTS release_notes text;

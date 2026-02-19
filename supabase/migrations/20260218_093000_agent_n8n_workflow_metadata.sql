-- Add starter workflow metadata + health metrics for n8n agent connections

ALTER TABLE public.agent_n8n_connections
    ADD COLUMN IF NOT EXISTS starter_workflow_id text,
    ADD COLUMN IF NOT EXISTS starter_workflow_url text,
    ADD COLUMN IF NOT EXISTS starter_template_version text,
    ADD COLUMN IF NOT EXISTS starter_installed_at timestamptz,
    ADD COLUMN IF NOT EXISTS starter_workflow_active boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_execution_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_execution_status text,
    ADD COLUMN IF NOT EXISTS execution_success_rate numeric(5,2),
    ADD COLUMN IF NOT EXISTS execution_avg_duration_ms integer;

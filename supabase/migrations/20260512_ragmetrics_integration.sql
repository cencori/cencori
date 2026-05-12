-- RagMetrics Integration Migration
-- Adds support for live AI evaluation via RagMetrics

-- 1. Add RagMetrics settings to project_settings
ALTER TABLE public.project_settings
ADD COLUMN IF NOT EXISTS ragmetrics_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ragmetrics_api_key text,
ADD COLUMN IF NOT EXISTS ragmetrics_config jsonb DEFAULT '{}'::jsonb;

-- 2. Add RagMetrics fields to ai_requests to store evaluation results
ALTER TABLE public.ai_requests
ADD COLUMN IF NOT EXISTS evaluation_status text DEFAULT 'pending' CHECK (evaluation_status IN ('pending', 'completed', 'failed', 'skipped')),
ADD COLUMN IF NOT EXISTS evaluation_score float,
ADD COLUMN IF NOT EXISTS evaluation_details jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS evaluation_at timestamptz;

-- 3. Create index for filtering by evaluation score
CREATE INDEX IF NOT EXISTS idx_ai_requests_evaluation_score ON public.ai_requests(evaluation_score) WHERE evaluation_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_requests_project_eval ON public.ai_requests(project_id, evaluation_status);

-- 4. Audit Log Category for Integrations
-- (Assumes audit_logs table exists and uses category text)
COMMENT ON COLUMN public.project_settings.ragmetrics_api_key IS 'Encrypted RagMetrics API key for live evaluation';

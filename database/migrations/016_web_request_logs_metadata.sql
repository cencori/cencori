-- Web Logs: capture richer middleware context for dense request detail views

ALTER TABLE public.web_request_logs
    ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMENT ON COLUMN public.web_request_logs.metadata IS 'Structured middleware context (runtime, scope, headers, and deployment hints)';

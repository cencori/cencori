-- API Gateway: project-scoped HTTP request logs (separate from AI token/cost logs)

CREATE TABLE IF NOT EXISTS public.api_gateway_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,

    request_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL DEFAULT 0,

    environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'test')),
    ip_address TEXT,
    country_code TEXT,
    user_agent TEXT,
    error_code TEXT,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_gateway_logs_project_created
    ON public.api_gateway_request_logs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_gateway_logs_project_status
    ON public.api_gateway_request_logs(project_id, status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_gateway_logs_project_endpoint
    ON public.api_gateway_request_logs(project_id, endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_gateway_logs_project_api_key
    ON public.api_gateway_request_logs(project_id, api_key_id, created_at DESC);

ALTER TABLE public.api_gateway_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view api gateway logs for their organization projects"
    ON public.api_gateway_request_logs
    FOR SELECT
    USING (
        project_id IN (
            SELECT p.id
            FROM public.projects p
            JOIN public.organization_members om ON om.organization_id = p.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can insert api gateway logs"
    ON public.api_gateway_request_logs
    FOR INSERT
    WITH CHECK (true);

COMMENT ON TABLE public.api_gateway_request_logs IS 'HTTP-level API gateway request logs for /api/v1 endpoints';

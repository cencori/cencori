-- Web Logs: dashboard HTTP request logs scoped to projects

CREATE TABLE IF NOT EXISTS public.web_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    request_id TEXT NOT NULL,
    host TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    query_string TEXT,
    status_code INTEGER NOT NULL,
    message TEXT,

    user_agent TEXT,
    referer TEXT,
    ip_address TEXT,
    country_code TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_request_logs_project_created
    ON public.web_request_logs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_request_logs_project_status
    ON public.web_request_logs(project_id, status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_request_logs_project_method
    ON public.web_request_logs(project_id, method, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_request_logs_org_created
    ON public.web_request_logs(organization_id, created_at DESC);

ALTER TABLE public.web_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view web logs for their organization projects"
    ON public.web_request_logs
    FOR SELECT
    USING (
        project_id IN (
            SELECT p.id
            FROM public.projects p
            JOIN public.organization_members om ON om.organization_id = p.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can insert web logs"
    ON public.web_request_logs
    FOR INSERT
    WITH CHECK (true);

COMMENT ON TABLE public.web_request_logs IS 'HTTP request logs for dashboard web traffic scoped to projects';

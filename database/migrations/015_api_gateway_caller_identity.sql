-- API Gateway logs: caller app attribution (Origin/Referer/X-Cencori-App)

ALTER TABLE public.api_gateway_request_logs
    ADD COLUMN IF NOT EXISTS caller_origin TEXT,
    ADD COLUMN IF NOT EXISTS client_app TEXT;

CREATE INDEX IF NOT EXISTS idx_api_gateway_logs_project_caller_origin
    ON public.api_gateway_request_logs(project_id, caller_origin, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_gateway_logs_project_client_app
    ON public.api_gateway_request_logs(project_id, client_app, created_at DESC);

COMMENT ON COLUMN public.api_gateway_request_logs.caller_origin IS 'Origin or referer value of calling app when available';
COMMENT ON COLUMN public.api_gateway_request_logs.client_app IS 'Optional client app identifier from X-Cencori-App header';

-- API Gateway logs: caller app attribution (Origin/Referer/X-Cencori-App)

alter table public.api_gateway_request_logs
    add column if not exists caller_origin text,
    add column if not exists client_app text;

create index if not exists idx_api_gateway_logs_project_caller_origin
    on public.api_gateway_request_logs(project_id, caller_origin, created_at desc);

create index if not exists idx_api_gateway_logs_project_client_app
    on public.api_gateway_request_logs(project_id, client_app, created_at desc);

comment on column public.api_gateway_request_logs.caller_origin is 'Origin or referer value of calling app when available';
comment on column public.api_gateway_request_logs.client_app is 'Optional client app identifier from X-Cencori-App header';

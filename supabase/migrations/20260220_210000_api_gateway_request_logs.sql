-- API Gateway request logs (HTTP-level, separate from ai_requests)

create table if not exists public.api_gateway_request_logs (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    api_key_id uuid not null references public.api_keys(id) on delete cascade,

    request_id text not null,
    endpoint text not null,
    method text not null,
    status_code integer not null,
    latency_ms integer not null default 0,

    environment text not null default 'production' check (environment in ('production', 'test')),
    ip_address text,
    country_code text,
    user_agent text,
    error_code text,
    error_message text,
    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz default now()
);

create index if not exists idx_api_gateway_logs_project_created
    on public.api_gateway_request_logs(project_id, created_at desc);

create index if not exists idx_api_gateway_logs_project_status
    on public.api_gateway_request_logs(project_id, status_code, created_at desc);

create index if not exists idx_api_gateway_logs_project_endpoint
    on public.api_gateway_request_logs(project_id, endpoint, created_at desc);

create index if not exists idx_api_gateway_logs_project_api_key
    on public.api_gateway_request_logs(project_id, api_key_id, created_at desc);

alter table public.api_gateway_request_logs enable row level security;

drop policy if exists "Users can view api gateway logs for their organization projects" on public.api_gateway_request_logs;
create policy "Users can view api gateway logs for their organization projects"
    on public.api_gateway_request_logs
    for select
    using (
        project_id in (
            select p.id
            from public.projects p
            join public.organization_members om on om.organization_id = p.organization_id
            where om.user_id = auth.uid()
        )
    );

drop policy if exists "Service role can insert api gateway logs" on public.api_gateway_request_logs;
create policy "Service role can insert api gateway logs"
    on public.api_gateway_request_logs
    for insert
    with check (true);

comment on table public.api_gateway_request_logs is 'HTTP-level API gateway request logs for /api/v1 endpoints';

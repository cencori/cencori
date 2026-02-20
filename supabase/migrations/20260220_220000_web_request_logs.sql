-- Web request logs for dashboard traffic (project-scoped)

create table if not exists public.web_request_logs (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,

    request_id text not null,
    host text not null,
    method text not null,
    path text not null,
    query_string text,
    status_code integer not null,
    message text,

    user_agent text,
    referer text,
    ip_address text,
    country_code text,

    created_at timestamptz default now()
);

create index if not exists idx_web_request_logs_project_created
    on public.web_request_logs(project_id, created_at desc);

create index if not exists idx_web_request_logs_project_status
    on public.web_request_logs(project_id, status_code, created_at desc);

create index if not exists idx_web_request_logs_project_method
    on public.web_request_logs(project_id, method, created_at desc);

create index if not exists idx_web_request_logs_org_created
    on public.web_request_logs(organization_id, created_at desc);

alter table public.web_request_logs enable row level security;

drop policy if exists "Users can view web logs for their organization projects" on public.web_request_logs;
create policy "Users can view web logs for their organization projects"
    on public.web_request_logs
    for select
    using (
        project_id in (
            select p.id
            from public.projects p
            join public.organization_members om on om.organization_id = p.organization_id
            where om.user_id = auth.uid()
        )
    );

drop policy if exists "Service role can insert web logs" on public.web_request_logs;
create policy "Service role can insert web logs"
    on public.web_request_logs
    for insert
    with check (true);

comment on table public.web_request_logs is 'HTTP request logs for dashboard web traffic scoped to projects';

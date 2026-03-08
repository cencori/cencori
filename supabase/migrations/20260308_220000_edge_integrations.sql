create table if not exists public.edge_integrations (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    provider text not null check (provider in ('vercel', 'supabase', 'cloudflare', 'aws', 'azure', 'gcp')),
    status text not null default 'pending' check (status in ('pending', 'connected', 'error', 'disconnected')),
    installed_via text not null default 'manual' check (installed_via in ('marketplace', 'oauth', 'manual', 'system')),
    external_account_id text,
    external_account_name text,
    external_project_id text not null,
    external_project_name text not null,
    external_project_slug text,
    capabilities jsonb not null default '{"logs": false, "deployments": false, "domains": false}'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    connected_by uuid references auth.users(id) on delete set null,
    connected_at timestamptz not null default now(),
    disconnected_at timestamptz,
    last_synced_at timestamptz,
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (project_id, provider, external_project_id)
);

create index if not exists idx_edge_integrations_project_provider
    on public.edge_integrations(project_id, provider, created_at desc);

create index if not exists idx_edge_integrations_org_provider
    on public.edge_integrations(organization_id, provider, created_at desc);

create table if not exists public.edge_integration_domains (
    id uuid primary key default gen_random_uuid(),
    integration_id uuid not null references public.edge_integrations(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    provider text not null check (provider in ('vercel', 'supabase', 'cloudflare', 'aws', 'azure', 'gcp')),
    domain text not null,
    environment text not null default 'production' check (environment in ('production', 'preview', 'development')),
    is_primary boolean not null default false,
    metadata jsonb not null default '{}'::jsonb,
    last_seen_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (integration_id, domain)
);

create index if not exists idx_edge_domains_project_domain
    on public.edge_integration_domains(project_id, domain);

create index if not exists idx_edge_domains_project_environment
    on public.edge_integration_domains(project_id, environment, created_at desc);

create table if not exists public.edge_deployments (
    id uuid primary key default gen_random_uuid(),
    integration_id uuid not null references public.edge_integrations(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    provider text not null check (provider in ('vercel', 'supabase', 'cloudflare', 'aws', 'azure', 'gcp')),
    external_deployment_id text not null,
    environment text not null default 'preview' check (environment in ('production', 'preview', 'development')),
    status text not null default 'created' check (status in ('created', 'building', 'ready', 'error', 'canceled', 'promoted')),
    deployment_url text,
    branch_url text,
    commit_sha text,
    commit_ref text,
    metadata jsonb not null default '{}'::jsonb,
    started_at timestamptz,
    ready_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (integration_id, external_deployment_id)
);

create index if not exists idx_edge_deployments_project_created
    on public.edge_deployments(project_id, created_at desc);

create index if not exists idx_edge_deployments_project_status
    on public.edge_deployments(project_id, status, created_at desc);

alter table public.edge_integrations enable row level security;
alter table public.edge_integration_domains enable row level security;
alter table public.edge_deployments enable row level security;

drop policy if exists "Users can view edge integrations for their organization projects" on public.edge_integrations;
create policy "Users can view edge integrations for their organization projects"
    on public.edge_integrations
    for select
    using (
        project_id in (
            select p.id
            from public.projects p
            join public.organization_members om on om.organization_id = p.organization_id
            where om.user_id = auth.uid()
        )
    );

drop policy if exists "Users can view edge domains for their organization projects" on public.edge_integration_domains;
create policy "Users can view edge domains for their organization projects"
    on public.edge_integration_domains
    for select
    using (
        project_id in (
            select p.id
            from public.projects p
            join public.organization_members om on om.organization_id = p.organization_id
            where om.user_id = auth.uid()
        )
    );

drop policy if exists "Users can view edge deployments for their organization projects" on public.edge_deployments;
create policy "Users can view edge deployments for their organization projects"
    on public.edge_deployments
    for select
    using (
        project_id in (
            select p.id
            from public.projects p
            join public.organization_members om on om.organization_id = p.organization_id
            where om.user_id = auth.uid()
        )
    );

drop policy if exists "Service role can manage edge integrations" on public.edge_integrations;
create policy "Service role can manage edge integrations"
    on public.edge_integrations
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage edge domains" on public.edge_integration_domains;
create policy "Service role can manage edge domains"
    on public.edge_integration_domains
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage edge deployments" on public.edge_deployments;
create policy "Service role can manage edge deployments"
    on public.edge_deployments
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

comment on table public.edge_integrations is 'Project-scoped deployment platform connections used for zero-code traffic and deployment sync';
comment on table public.edge_integration_domains is 'Normalized domains discovered from connected edge integrations';
comment on table public.edge_deployments is 'Normalized deployment events discovered from connected edge integrations';

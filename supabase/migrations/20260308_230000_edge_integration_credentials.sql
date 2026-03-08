create table if not exists public.edge_integration_credentials (
    integration_id uuid primary key references public.edge_integrations(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    provider text not null check (provider in ('vercel', 'supabase', 'cloudflare', 'aws', 'azure', 'gcp')),
    access_token_encrypted text,
    webhook_secret_encrypted text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_edge_integration_credentials_project_provider
    on public.edge_integration_credentials(project_id, provider);

alter table public.edge_integration_credentials enable row level security;

drop policy if exists "Service role can manage edge integration credentials" on public.edge_integration_credentials;
create policy "Service role can manage edge integration credentials"
    on public.edge_integration_credentials
    for all
    using (true)
    with check (true);

comment on table public.edge_integration_credentials is 'Private provider credentials and webhook secrets for connected edge integrations';

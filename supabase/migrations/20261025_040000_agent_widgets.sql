-- Website widget: one embeddable chat per agent. Visitors are anonymous, so
-- each widget runs through its own "website visitors" customer (tenant) and
-- an installation of the agent on the stable channel. The public key is not
-- a secret: what keeps it on the owner's sites is the frame-ancestors list
-- built from allowed_origins, plus per-visitor and per-day limits.
create table if not exists public.agent_widgets (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    agent_id uuid not null references public.agents(id) on delete cascade,
    public_key text not null,
    enabled boolean not null default false,
    allowed_origins text[] not null default '{}',
    tenant_id uuid references public.platform_tenants(id) on delete set null,
    installation_id uuid references public.agent_installations(id) on delete set null,
    appearance jsonb not null default '{}'::jsonb,
    daily_session_cap integer not null default 500 check (daily_session_cap between 1 and 100000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists agent_widgets_agent_id_key on public.agent_widgets (agent_id);
create unique index if not exists agent_widgets_public_key_key on public.agent_widgets (public_key);
create index if not exists agent_widgets_project_id_idx on public.agent_widgets (project_id);

-- Server-only: every read and write goes through the service role.
alter table public.agent_widgets enable row level security;

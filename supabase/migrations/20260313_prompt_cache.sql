-- Prompt Cache System: exact-match + semantic caching for AI gateway
-- Tables: prompt_cache_entries, prompt_cache_events, prompt_cache_settings

-- Enable pgvector if not already enabled
create extension if not exists vector;

-- ===== Prompt Cache Entries =====
create table if not exists public.prompt_cache_entries (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    cache_key text not null,
    prompt_text text not null,
    model text not null,
    temperature numeric,
    max_tokens integer,
    response jsonb not null,
    embedding vector(768),
    expires_at timestamptz not null,
    hit_count integer not null default 0,
    last_hit_at timestamptz,
    tokens_saved integer not null default 0,
    cost_saved_usd numeric not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index idx_prompt_cache_project_key
    on public.prompt_cache_entries(project_id, cache_key);

create index idx_prompt_cache_expires
    on public.prompt_cache_entries(expires_at);

create index idx_prompt_cache_embedding
    on public.prompt_cache_entries
    using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index idx_prompt_cache_hits
    on public.prompt_cache_entries(project_id, hit_count desc);

-- ===== Cache Event Log =====
create table if not exists public.prompt_cache_events (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    cache_entry_id uuid references public.prompt_cache_entries(id) on delete set null,
    event_type text not null check (event_type in ('hit_exact', 'hit_semantic', 'miss', 'store', 'evict', 'invalidate')),
    model text,
    similarity_score numeric,
    latency_saved_ms integer,
    tokens_saved integer,
    cost_saved_usd numeric,
    request_id text,
    created_at timestamptz not null default now()
);

create index idx_cache_events_project_time
    on public.prompt_cache_events(project_id, created_at desc);

create index idx_cache_events_type
    on public.prompt_cache_events(project_id, event_type, created_at desc);

-- ===== Per-Project Cache Settings =====
create table if not exists public.prompt_cache_settings (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    cache_enabled boolean not null default false,
    exact_match_enabled boolean not null default true,
    semantic_match_enabled boolean not null default false,
    ttl_seconds integer not null default 3600,
    similarity_threshold numeric not null default 0.95,
    max_entries integer not null default 10000,
    excluded_models text[] not null default '{}',
    max_cacheable_temperature numeric not null default 0.2,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint unique_project_cache_settings unique (project_id)
);

-- ===== RPC: Semantic cache search =====
create or replace function match_prompt_cache(
    p_project_id uuid,
    query_embedding vector(768),
    match_threshold float,
    match_count int
)
returns table (
    id uuid,
    cache_key text,
    prompt_text text,
    response jsonb,
    model text,
    tokens_saved integer,
    cost_saved_usd numeric,
    similarity float
)
language plpgsql
as $$
begin
    return query
    select
        pce.id,
        pce.cache_key,
        pce.prompt_text,
        pce.response,
        pce.model,
        pce.tokens_saved,
        pce.cost_saved_usd,
        1 - (pce.embedding <=> query_embedding) as similarity
    from public.prompt_cache_entries pce
    where pce.project_id = p_project_id
      and pce.expires_at > now()
      and pce.embedding is not null
      and 1 - (pce.embedding <=> query_embedding) > match_threshold
    order by pce.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- ===== RPC: Increment hit counter =====
create or replace function increment_cache_hit(
    p_entry_id uuid,
    p_tokens integer default 0,
    p_cost numeric default 0
)
returns void
language plpgsql
as $$
begin
    update public.prompt_cache_entries
    set hit_count = hit_count + 1,
        last_hit_at = now(),
        tokens_saved = tokens_saved + p_tokens,
        cost_saved_usd = cost_saved_usd + p_cost
    where id = p_entry_id;
end;
$$;

-- ===== RLS =====
alter table public.prompt_cache_entries enable row level security;
alter table public.prompt_cache_events enable row level security;
alter table public.prompt_cache_settings enable row level security;

-- Service role full access
create policy "Service role full access on prompt_cache_entries"
    on public.prompt_cache_entries for all using (true) with check (true);

create policy "Service role full access on prompt_cache_events"
    on public.prompt_cache_events for all using (true) with check (true);

create policy "Service role full access on prompt_cache_settings"
    on public.prompt_cache_settings for all using (true) with check (true);

-- Users can read their org's project cache data
create policy "Users can view cache entries for their projects"
    on public.prompt_cache_entries for select
    using (project_id in (
        select p.id from public.projects p
        join public.organization_members om on om.organization_id = p.organization_id
        where om.user_id = auth.uid()
    ));

create policy "Users can view cache events for their projects"
    on public.prompt_cache_events for select
    using (project_id in (
        select p.id from public.projects p
        join public.organization_members om on om.organization_id = p.organization_id
        where om.user_id = auth.uid()
    ));

create policy "Users can manage cache settings for their projects"
    on public.prompt_cache_settings for all
    using (project_id in (
        select p.id from public.projects p
        join public.organization_members om on om.organization_id = p.organization_id
        where om.user_id = auth.uid()
    ));

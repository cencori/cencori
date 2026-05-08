-- Prompt cache launch hardening:
-- - scope entries/events by environment
-- - keep original per-entry token/cost estimates for hit-savings analytics
-- - constrain semantic matches to the same environment, model, and max_tokens shape

alter table public.prompt_cache_entries
    add column if not exists environment text not null default 'production'
        check (environment in ('production', 'test')),
    add column if not exists estimated_tokens integer not null default 0,
    add column if not exists estimated_cost_usd numeric not null default 0;

alter table public.prompt_cache_events
    add column if not exists environment text not null default 'production'
        check (environment in ('production', 'test'));

create index if not exists idx_prompt_cache_entries_project_env_key
    on public.prompt_cache_entries(project_id, environment, cache_key);

create index if not exists idx_prompt_cache_entries_project_env_model_expires
    on public.prompt_cache_entries(project_id, environment, model, expires_at);

create index if not exists idx_prompt_cache_events_project_env_time
    on public.prompt_cache_events(project_id, environment, created_at desc);

create or replace function match_prompt_cache(
    p_project_id uuid,
    query_embedding vector(768),
    match_threshold float,
    match_count int,
    p_environment text default 'production',
    p_model text default null,
    p_max_tokens integer default null
)
returns table (
    id uuid,
    cache_key text,
    prompt_text text,
    response jsonb,
    model text,
    tokens_saved integer,
    cost_saved_usd numeric,
    estimated_tokens integer,
    estimated_cost_usd numeric,
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
        pce.estimated_tokens,
        pce.estimated_cost_usd,
        1 - (pce.embedding <=> query_embedding) as similarity
    from public.prompt_cache_entries pce
    where pce.project_id = p_project_id
      and (p_environment is null or pce.environment = p_environment)
      and (p_model is null or pce.model = p_model)
      and (
          (p_max_tokens is null and pce.max_tokens is null)
          or pce.max_tokens = p_max_tokens
      )
      and pce.expires_at > now()
      and pce.embedding is not null
      and 1 - (pce.embedding <=> query_embedding) > match_threshold
    order by pce.embedding <=> query_embedding
    limit match_count;
end;
$$;

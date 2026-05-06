-- Fast cache analytics aggregation functions
-- Run this migration to speed up the cache analytics page

-- ===== RPC: Cache event counts (fast) =====
create or replace function get_cache_event_counts(
    p_project_id uuid,
    p_since timestamptz,
    p_environment text default 'production'
)
returns table (hit_exact bigint, hit_semantic bigint, miss bigint)
language plpgsql
as $$
begin
    return query
    with events as (
        select event_type
        from public.prompt_cache_events
        where project_id = p_project_id
          and created_at >= p_since
          and (p_environment is null or environment = p_environment)
    )
    select
        (select count(*)::bigint from events where event_type = 'hit_exact') as hit_exact,
        (select count(*)::bigint from events where event_type = 'hit_semantic') as hit_semantic,
        (select count(*)::bigint from events where event_type = 'miss') as miss;
end;
$$;

-- ===== RPC: Cache savings aggregation (fast) =====
create or replace function get_cache_savings(
    p_project_id uuid,
    p_since timestamptz,
    p_environment text default 'production'
)
returns table (total_tokens bigint, total_cost numeric)
language plpgsql
as $$
begin
    return query
    select
        coalesce(sum(tokens_saved), 0)::bigint as total_tokens,
        coalesce(sum(cost_saved_usd), 0)::numeric as total_cost
    from public.prompt_cache_events
    where project_id = p_project_id
      and created_at >= p_since
      and event_type in ('hit_exact', 'hit_semantic')
      and (p_environment is null or environment = p_environment);
end;
$$;

-- ===== RPC: Cache time buckets (fast) =====
create or replace function get_cache_time_buckets(
    p_project_id uuid,
    p_since timestamptz,
    p_environment text default 'production',
    p_bucket_seconds bigint default 3600
)
returns table (bucket timestamptz, hits bigint, total bigint)
language plpgsql
as $$
begin
    return query
    select
        date_trunc('hour', created_at) as bucket,
        count(*) filter (where event_type in ('hit_exact', 'hit_semantic'))::bigint as hits,
        count(*)::bigint as total
    from public.prompt_cache_events
    where project_id = p_project_id
      and created_at >= p_since
      and event_type in ('hit_exact', 'hit_semantic', 'miss')
      and (p_environment is null or environment = p_environment)
    group by date_trunc('hour', created_at)
    order by bucket;
end;
$$;
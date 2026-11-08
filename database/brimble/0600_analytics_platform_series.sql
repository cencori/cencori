-- Platform-wide time series for the internal Overview charts
-- (/internal, GET /api/internal/metrics/series). Same shape of data the
-- console's project usage charts plot, but across every project, bucketed in
-- SQL so a long window never ships rows to Node.
--
-- p_bucket is the bucket width (e.g. '5 minutes', '1 hour', '1 day', '7 days').
-- The series starts at the first logged request when p_start is earlier, so
-- "All time" doesn't generate empty buckets back to 1970.
--
-- Reads only narrow columns of ai_requests (never the payloads) and uses
-- idx_ai_requests_created_at for the window.

create or replace function public.analytics_platform_series(p_start timestamptz, p_bucket interval)
returns jsonb
language sql
stable
-- Runs as its owner: signups come from auth_users, which
-- 0100_lock_auth_tables.sql closes to every API role (it holds password
-- hashes). Only counts leave this function, and only service_role may call it.
security definer
set search_path = public
-- Bucket edges and generate_series must agree: in a zone with daylight
-- saving, a '1 day' step crosses the change as 23 or 25 hours and every later
-- bucket misses its date_bin key (reads as zero). UTC has no such jump.
set timezone = 'UTC'
as $$
    with bounds as (
        select
            date_bin(
                p_bucket,
                greatest(p_start, coalesce((select min(created_at) from public.ai_requests), now())),
                timestamptz '2000-01-01'
            ) as lo,
            date_bin(p_bucket, now(), timestamptz '2000-01-01') as hi
    ),
    buckets as (
        select generate_series(lo, hi, p_bucket) as t from bounds
    ),
    req as (
        select
            date_bin(p_bucket, created_at, timestamptz '2000-01-01') as t,
            count(*) as requests,
            count(*) filter (where status in ('success', 'success_fallback')) as successful,
            count(*) filter (where status = 'error') as errors,
            count(*) filter (where status in ('filtered', 'blocked')) as filtered,
            coalesce(sum(cost_usd), 0) as cost,
            coalesce(sum(prompt_tokens), 0) as prompt_tokens,
            coalesce(sum(completion_tokens), 0) as completion_tokens,
            percentile_cont(0.5) within group (order by latency_ms) filter (where latency_ms > 0) as p50,
            percentile_cont(0.95) within group (order by latency_ms) filter (where latency_ms > 0) as p95,
            percentile_cont(0.99) within group (order by latency_ms) filter (where latency_ms > 0) as p99
        from public.ai_requests
        where created_at >= p_start
        group by 1
    ),
    signups as (
        select date_bin(p_bucket, "createdAt", timestamptz '2000-01-01') as t, count(*) as n
        from public.auth_users
        where "createdAt" >= p_start
        group by 1
    ),
    orgs as (
        select date_bin(p_bucket, created_at, timestamptz '2000-01-01') as t, count(*) as n
        from public.organizations
        where created_at >= p_start
        group by 1
    )
    select jsonb_build_object(
        'series', (
            select coalesce(jsonb_agg(jsonb_build_object(
                't', (extract(epoch from b.t) * 1000)::bigint,
                'requests', coalesce(r.requests, 0),
                'successful', coalesce(r.successful, 0),
                'errors', coalesce(r.errors, 0),
                'filtered', coalesce(r.filtered, 0),
                'cost', coalesce(r.cost, 0),
                'prompt_tokens', coalesce(r.prompt_tokens, 0),
                'completion_tokens', coalesce(r.completion_tokens, 0),
                'p50', coalesce(round(r.p50), 0),
                'p95', coalesce(round(r.p95), 0),
                'p99', coalesce(round(r.p99), 0),
                'signups', coalesce(s.n, 0),
                'orgs', coalesce(o.n, 0)
            ) order by b.t), '[]'::jsonb)
            from buckets b
            left join req r on r.t = b.t
            left join signups s on s.t = b.t
            left join orgs o on o.t = b.t
        ),
        'model_usage', (
            select coalesce(jsonb_object_agg(m, n), '{}'::jsonb)
            from (
                select coalesce(model, 'unknown') as m, count(*) as n
                from public.ai_requests
                where created_at >= p_start
                group by 1
            ) x
        ),
        'cost_by_provider', (
            select coalesce(jsonb_object_agg(p, c), '{}'::jsonb)
            from (
                select coalesce(provider, 'unknown') as p, coalesce(sum(cost_usd), 0) as c
                from public.ai_requests
                where created_at >= p_start
                group by 1
            ) x
        ),
        'latency', (
            select jsonb_build_object(
                'p50', coalesce(round(percentile_cont(0.5) within group (order by latency_ms)), 0),
                'p95', coalesce(round(percentile_cont(0.95) within group (order by latency_ms)), 0),
                'p99', coalesce(round(percentile_cont(0.99) within group (order by latency_ms)), 0)
            )
            from public.ai_requests
            where created_at >= p_start and latency_ms > 0
        ),
        'users_total', (select count(*) from public.auth_users),
        'orgs_total', (select count(*) from public.organizations)
    );
$$;

revoke all on function public.analytics_platform_series(timestamptz, interval) from public;
do $$ begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on function public.analytics_platform_series(timestamptz, interval) from anon, authenticated;
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        grant execute on function public.analytics_platform_series(timestamptz, interval) to service_role;
    end if;
end $$;

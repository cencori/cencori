-- Raw gateway timings for the internal latency view (internal/analytics,
-- /api/internal/metrics/latency). Returned as one jsonb array, not a set, so
-- PostgREST row caps don't truncate it; the route groups by country itself
-- because rows logged on Brimble before the IP lookup shipped have only an IP.
-- Each row: [created_at epoch ms, country_code, ip_address, status_code,
--            gateway_preflight_ms, provider_ttft_ms, client_ttft_ms, latency_ms]

create or replace function public.analytics_gateway_latency_rows(p_start timestamptz, p_end timestamptz default now())
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(jsonb_agg(jsonb_build_array(
        (extract(epoch from created_at) * 1000)::bigint,
        country_code,
        ip_address,
        status_code,
        gateway_preflight_ms,
        provider_ttft_ms,
        client_ttft_ms,
        latency_ms
    )), '[]'::jsonb)
    from public.api_gateway_request_logs
    where created_at >= p_start and created_at < p_end;
$$;

revoke all on function public.analytics_gateway_latency_rows(timestamptz, timestamptz) from public;
do $$ begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on function public.analytics_gateway_latency_rows(timestamptz, timestamptz) from anon, authenticated;
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        grant execute on function public.analytics_gateway_latency_rows(timestamptz, timestamptz) to service_role;
    end if;
end $$;

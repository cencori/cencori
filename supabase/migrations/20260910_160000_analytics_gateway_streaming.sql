-- Follow-up to 20260910_140000_analytics_aggregates.sql.
--
-- The first version of analytics_gateway_metrics read
-- `request_payload ->> 'stream'` inside the rollup, which detoasts the ~5.5 KB
-- payload for every row in the window — the exact weight the rollup exists to
-- avoid. Against a 30d window (12,784 rows) it hit `canceling statement due to
-- statement timeout`, so the dashboard fell back to the row scan.
--
-- Fix: keep the rollup payload-free, and serve the streaming split from a
-- partial index that stores the flag, so counting streamed requests never
-- touches the payload column at query time.

-- ---------------------------------------------------------------------------
-- Streaming split
-- ---------------------------------------------------------------------------

-- Predicate matches analytics_gateway_streaming's WHERE clause exactly, so the
-- planner can use this for the time-window count.
CREATE INDEX IF NOT EXISTS idx_ai_requests_streaming_created_at
    ON public.ai_requests (created_at DESC)
    WHERE (request_payload ->> 'stream') = 'true';

CREATE OR REPLACE FUNCTION public.analytics_gateway_streaming(p_start timestamptz)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT COUNT(*)
    FROM public.ai_requests
    WHERE created_at >= p_start
      AND (request_payload ->> 'stream') = 'true';
$$;

COMMENT ON FUNCTION public.analytics_gateway_streaming(timestamptz) IS
    'Platform analytics: streamed gateway requests in [p_start, now). Served by idx_ai_requests_streaming_created_at. Internal dashboard only.';

-- ---------------------------------------------------------------------------
-- Payload-free gateway rollup
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_gateway_metrics(p_start timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    WITH base AS (
        -- Scalar columns only: no request_payload/response_payload, or this
        -- scan detoasts its way past the statement timeout.
        SELECT
            status,
            COALESCE(total_tokens, 0)     AS total_tokens,
            COALESCE(cost_usd, 0)         AS cost_usd,
            COALESCE(latency_ms, 0)       AS latency_ms,
            COALESCE(provider, 'unknown') AS provider,
            COALESCE(model, 'unknown')    AS model
        FROM public.ai_requests
        WHERE created_at >= p_start
    ),
    totals AS (
        SELECT
            COUNT(*)                                                          AS total_requests,
            COUNT(*) FILTER (WHERE status IN ('success', 'success_fallback'))  AS successful_requests,
            COUNT(*) FILTER (WHERE status = 'error')                          AS error_requests,
            COUNT(*) FILTER (WHERE status IN ('filtered', 'blocked'))         AS filtered_requests,
            COALESCE(SUM(total_tokens), 0)                                    AS total_tokens,
            COALESCE(SUM(cost_usd), 0)                                        AS total_cost,
            COALESCE(ROUND(AVG(latency_ms)), 0)                               AS avg_latency
        FROM base
    ),
    providers AS (
        SELECT COALESCE(jsonb_object_agg(provider, n), '{}'::jsonb) AS j
        FROM (SELECT provider, COUNT(*) AS n FROM base GROUP BY provider) s
    ),
    models AS (
        SELECT COALESCE(jsonb_object_agg(model, n), '{}'::jsonb) AS j
        FROM (SELECT model, COUNT(*) AS n FROM base GROUP BY model) s
    )
    SELECT jsonb_build_object(
        'total_requests',       t.total_requests,
        'successful_requests',  t.successful_requests,
        'error_requests',       t.error_requests,
        'filtered_requests',    t.filtered_requests,
        'total_tokens',         t.total_tokens,
        'total_cost',           t.total_cost,
        'avg_latency',          t.avg_latency,
        'requests_by_provider', p.j,
        'requests_by_model',    m.j
    )
    FROM totals t, providers p, models m;
$$;

COMMENT ON FUNCTION public.analytics_gateway_metrics(timestamptz) IS
    'Platform analytics: AI Gateway rollup for [p_start, now), payload-free. Streaming split lives in analytics_gateway_streaming. Internal dashboard only.';

-- ---------------------------------------------------------------------------
-- Grants: service role only
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.analytics_gateway_metrics(timestamptz)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analytics_gateway_streaming(timestamptz) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.analytics_gateway_metrics(timestamptz)   TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_gateway_streaming(timestamptz) TO service_role;

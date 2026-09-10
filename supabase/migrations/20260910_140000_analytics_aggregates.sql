-- Platform analytics: aggregate in SQL instead of shipping rows to Node.
--
-- Why: /internal/analytics computed gateway + security metrics by pulling every
-- row in the window through PostgREST. `ai_requests` rows carry
-- request_payload/response_payload (~5.5 KB/row), so a 30d window was a ~70 MB,
-- 13-page walk; `security_incidents.input_text` runs to ~14 KB/row. Neither
-- table had an index on created_at, so the window scan was sequential on top of
-- that. On Vercel those reads timed out, and every failure path in queries.ts
-- returns zeros — so the dashboard rendered "0 requests" while the gateway was
-- logging normally (12,774 rows in the 30d window on 2026-09-10).
--
-- These functions return one JSON row per section. They are SECURITY INVOKER:
-- the analytics API calls them with the service role, which bypasses RLS, and
-- EXECUTE is revoked from anon/authenticated so no one else can read
-- platform-wide aggregates.
--
-- The CREATE INDEX statements are not CONCURRENT: both tables are small
-- (~18k and ~800 rows), so the write lock is sub-second. Use CONCURRENTLY if
-- these tables have grown by the time you apply this.

-- ---------------------------------------------------------------------------
-- Indexes for the time-window scans
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_ai_requests_created_at
    ON public.ai_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_incidents_created_at
    ON public.security_incidents (created_at DESC);

-- ---------------------------------------------------------------------------
-- AI Gateway rollup
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_gateway_metrics(p_start timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    WITH base AS (
        SELECT
            status,
            COALESCE(total_tokens, 0)     AS total_tokens,
            COALESCE(cost_usd, 0)         AS cost_usd,
            COALESCE(latency_ms, 0)       AS latency_ms,
            COALESCE(provider, 'unknown') AS provider,
            COALESCE(model, 'unknown')    AS model,
            -- there is no `stream` column; the gateway records it on the payload
            (request_payload ->> 'stream') = 'true' AS is_stream
        FROM public.ai_requests
        WHERE created_at >= p_start
    ),
    totals AS (
        SELECT
            COUNT(*)                                                        AS total_requests,
            COUNT(*) FILTER (WHERE status IN ('success', 'success_fallback')) AS successful_requests,
            COUNT(*) FILTER (WHERE status = 'error')                        AS error_requests,
            COUNT(*) FILTER (WHERE status IN ('filtered', 'blocked'))       AS filtered_requests,
            COALESCE(SUM(total_tokens), 0)                                  AS total_tokens,
            COALESCE(SUM(cost_usd), 0)                                      AS total_cost,
            COALESCE(ROUND(AVG(latency_ms)), 0)                             AS avg_latency,
            COUNT(*) FILTER (WHERE is_stream)                               AS streaming_requests
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
        'total_requests',        t.total_requests,
        'successful_requests',   t.successful_requests,
        'error_requests',        t.error_requests,
        'filtered_requests',     t.filtered_requests,
        'total_tokens',          t.total_tokens,
        'total_cost',            t.total_cost,
        'avg_latency',           t.avg_latency,
        'streaming_requests',    t.streaming_requests,
        'non_streaming_requests', t.total_requests - t.streaming_requests,
        'requests_by_provider',  p.j,
        'requests_by_model',     m.j
    )
    FROM totals t, providers p, models m;
$$;

COMMENT ON FUNCTION public.analytics_gateway_metrics(timestamptz) IS
    'Platform analytics: AI Gateway rollup for [p_start, now). Internal dashboard only.';

-- ---------------------------------------------------------------------------
-- Security rollup
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_security_metrics(p_start timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    WITH base AS (
        SELECT
            COALESCE(incident_type, 'unknown') AS incident_type,
            severity
        FROM public.security_incidents
        WHERE created_at >= p_start
    ),
    totals AS (
        SELECT
            COUNT(*)                                        AS total_incidents,
            COUNT(*) FILTER (WHERE severity = 'low')        AS low,
            COUNT(*) FILTER (WHERE severity = 'medium')     AS medium,
            COUNT(*) FILTER (WHERE severity = 'high')       AS high,
            COUNT(*) FILTER (WHERE severity = 'critical')   AS critical
        FROM base
    ),
    types AS (
        SELECT COALESCE(jsonb_object_agg(incident_type, n), '{}'::jsonb) AS j
        FROM (SELECT incident_type, COUNT(*) AS n FROM base GROUP BY incident_type) s
    )
    SELECT jsonb_build_object(
        'total_incidents',     t.total_incidents,
        'incidents_by_type',   y.j,
        'incidents_by_severity', jsonb_build_object(
            'low', t.low, 'medium', t.medium, 'high', t.high, 'critical', t.critical
        )
    )
    FROM totals t, types y;
$$;

COMMENT ON FUNCTION public.analytics_security_metrics(timestamptz) IS
    'Platform analytics: security incident rollup for [p_start, now). Internal dashboard only.';

-- ---------------------------------------------------------------------------
-- Capture-by-product counts (one round trip instead of four exact counts)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_capture_metrics(p_start timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'gateway_requests',     (SELECT COUNT(*) FROM public.ai_requests             WHERE created_at >= p_start),
        'governance_decisions', (SELECT COUNT(*) FROM public.governance_audit_ledger WHERE ts         >= p_start),
        'memories',             (SELECT COUNT(*) FROM public.gateway_memories        WHERE created_at >= p_start),
        'agent_sessions',       (SELECT COUNT(*) FROM public.sessions                WHERE created_at >= p_start)
    );
$$;

COMMENT ON FUNCTION public.analytics_capture_metrics(timestamptz) IS
    'Platform analytics: workload capture per product for [p_start, now). Internal dashboard only.';

-- ---------------------------------------------------------------------------
-- Active orgs / projects / API keys (distinct counts over the same window)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_active_entities(p_start timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    WITH base AS (
        SELECT r.project_id, r.api_key_id, p.organization_id
        FROM public.ai_requests r
        LEFT JOIN public.projects p ON p.id = r.project_id
        WHERE r.created_at >= p_start
    )
    SELECT jsonb_build_object(
        'active_projects',      COUNT(DISTINCT project_id),
        'active_organizations', COUNT(DISTINCT organization_id),
        'active_api_keys',      COUNT(DISTINCT api_key_id)
    )
    FROM base;
$$;

COMMENT ON FUNCTION public.analytics_active_entities(timestamptz) IS
    'Platform analytics: distinct orgs/projects/API keys with gateway traffic in [p_start, now). Internal dashboard only.';

-- ---------------------------------------------------------------------------
-- Grants: service role only (these are platform-wide aggregates)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.analytics_gateway_metrics(timestamptz)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analytics_security_metrics(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analytics_capture_metrics(timestamptz)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analytics_active_entities(timestamptz)  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.analytics_gateway_metrics(timestamptz)  TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_security_metrics(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_capture_metrics(timestamptz)  TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_active_entities(timestamptz)  TO service_role;

-- Org Usage page: aggregate in SQL instead of shipping rows to the browser.
--
-- Why: /[orgSlug]/~/usage selected `*` from ai_requests for every org project
-- in the window and summed it client-side. Agent traffic carries the whole
-- conversation in request_payload (~58 KB/row for Arcie on 2026-10-13), so 7d
-- was ~40 MB and PostgREST hit the statement timeout (57014). The page ignored
-- the error and rendered "0 tokens / $0.00" while 706 requests were logged.
-- PostgREST also caps responses at 1000 rows, so wider windows undercounted.
--
-- Same fix as 20260910_140000_analytics_aggregates.sql for /internal/analytics.
-- SECURITY INVOKER; called by /api/organizations/[orgSlug]/usage with the
-- service role after an org membership check. EXECUTE revoked from clients.
--
-- Hourly buckets are UTC; the page re-buckets them into the viewer's local
-- hours/days so the chart keeps its local-time axis.

-- Every per-project window query on ai_requests wants this. If ai_requests has
-- grown large by the time you apply this, run it alone with CONCURRENTLY.
CREATE INDEX IF NOT EXISTS idx_ai_requests_project_created_at
    ON public.ai_requests (project_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.org_usage_stats(p_project_ids uuid[], p_start timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    WITH base AS (
        SELECT
            created_at,
            status,
            COALESCE(prompt_tokens, 0)     AS prompt_tokens,
            COALESCE(completion_tokens, 0) AS completion_tokens,
            COALESCE(total_tokens, 0)      AS total_tokens,
            COALESCE(cost_usd, 0)          AS cost_usd,
            latency_ms,
            model,
            COALESCE(provider, 'unknown')  AS provider
        FROM public.ai_requests
        WHERE project_id = ANY (p_project_ids)
          AND created_at >= p_start
    ),
    totals AS (
        SELECT
            COUNT(*)                                     AS total_requests,
            COUNT(*) FILTER (WHERE status = 'success')   AS successful_requests,
            COALESCE(SUM(total_tokens), 0)               AS total_tokens,
            COALESCE(SUM(prompt_tokens), 0)              AS input_tokens,
            COALESCE(SUM(completion_tokens), 0)          AS output_tokens,
            COALESCE(SUM(cost_usd), 0)                   AS total_cost,
            COALESCE(ROUND(AVG(latency_ms)), 0)          AS avg_latency
        FROM base
    ),
    models AS (
        SELECT COALESCE(jsonb_object_agg(model, n), '{}'::jsonb) AS j
        FROM (SELECT model, COUNT(*) AS n FROM base WHERE model IS NOT NULL GROUP BY model) s
    ),
    providers AS (
        SELECT COALESCE(jsonb_object_agg(provider, n), '{}'::jsonb) AS j
        FROM (SELECT provider, COUNT(*) AS n FROM base GROUP BY provider) s
    ),
    hourly AS (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'hour', hour, 'count', n, 'input_tokens', input_tokens, 'output_tokens', output_tokens
        ) ORDER BY hour), '[]'::jsonb) AS j
        FROM (
            SELECT
                date_trunc('hour', created_at) AS hour,
                COUNT(*)                       AS n,
                SUM(prompt_tokens)             AS input_tokens,
                SUM(completion_tokens)         AS output_tokens
            FROM base
            GROUP BY 1
        ) s
    )
    SELECT jsonb_build_object(
        'total_requests',      t.total_requests,
        'successful_requests', t.successful_requests,
        'total_tokens',        t.total_tokens,
        'input_tokens',        t.input_tokens,
        'output_tokens',       t.output_tokens,
        'total_cost',          t.total_cost,
        'avg_latency',         t.avg_latency,
        'model_usage',         m.j,
        'provider_usage',      p.j,
        'hourly',              h.j
    )
    FROM totals t, models m, providers p, hourly h;
$$;

COMMENT ON FUNCTION public.org_usage_stats(uuid[], timestamptz) IS
    'Org Usage page rollup over the given projects for [p_start, now). Service role only.';

REVOKE ALL ON FUNCTION public.org_usage_stats(uuid[], timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_usage_stats(uuid[], timestamptz) TO service_role;

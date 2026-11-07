-- Home "Spend" tile: total AI spend, including calls on the customer's own
-- provider keys (BYOK).
--
-- Cencori charges nothing for a BYOK call, so cost_usd is 0 and the spend
-- was invisible. From 2026-11-07 the gateway tags every request row with
-- metadata.billing_mode ('standard' | 'byok' | 'sponsored' | 'free').
-- total_spend = cost_usd (what Cencori charged) + provider_cost_usd of rows
-- tagged 'byok'. Untagged history is left as it was rather than guessed:
-- sponsored calls look identical to BYOK in old rows and must not count as
-- the customer's spend.
--
-- Same function as supabase/migrations/20261013_000000_org_usage_stats.sql
-- plus total_spend; all existing fields are unchanged. Idempotent (CREATE OR
-- REPLACE): runs before every deploy via scripts/brimble-apply-sql.mjs.

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
            -- What the customer paid their own provider for a BYOK call
            -- (Cencori charged nothing). Only rows tagged by the gateway
            -- count; untagged history and sponsored calls add nothing.
            CASE WHEN metadata->>'billing_mode' = 'byok'
                 THEN COALESCE(provider_cost_usd, 0) ELSE 0 END AS byok_cost_usd,
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
            COALESCE(SUM(cost_usd + byok_cost_usd), 0)   AS total_spend,
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
        'total_spend',         t.total_spend,
        'avg_latency',         t.avg_latency,
        'model_usage',         m.j,
        'provider_usage',      p.j,
        'hourly',              h.j
    )
    FROM totals t, models m, providers p, hourly h;
$$;

COMMENT ON FUNCTION public.org_usage_stats(uuid[], timestamptz) IS
    'Org usage rollup over the given projects for [p_start, now). total_cost = what Cencori charged; total_spend = that plus the provider cost of BYOK calls (tagged from 2026-11-07). Service role only.';

REVOKE ALL ON FUNCTION public.org_usage_stats(uuid[], timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_usage_stats(uuid[], timestamptz) TO service_role;

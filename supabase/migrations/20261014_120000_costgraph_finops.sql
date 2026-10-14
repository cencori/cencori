-- FinOps usage export (FOCUS 1.2) and the CostGraph integration.
--
-- Three pieces, all needed before Cencori usage can land in a FinOps tool:
--
--   1. Token buckets on ai_requests. Providers price cache reads, cache writes and
--      uncached input differently, and FinOps tools (CostGraph among them) price each
--      bucket separately. prompt_tokens cannot be split afterwards: OpenAI and Gemini
--      count cached tokens inside it, Anthropic leaves them out. So the gateway now
--      records the buckets at log time. NULL = the provider did not say; rows from
--      before this migration stay NULL and exports fall back to prompt_tokens.
--      The gateway keeps logging (without these columns) until this is applied.
--
--   2. Organization usage export keys (cuk_…). Project keys are scoped to one
--      project and can call models; a FinOps pull needs the whole organization and
--      must not be able to spend. These keys read usage and nothing else.
--
--   3. FinOps push connections — one per organization per destination (CostGraph
--      today). The nightly cron (/api/cron/finops-push) sends each settled day.
--
-- focus_usage_daily() does the aggregation in SQL: an org's month of traffic is
-- far more rows than PostgREST will return, and the export only needs the rollup.

-- ─── 1. Token buckets ────────────────────────────────────────────────────────

ALTER TABLE public.ai_requests
    ADD COLUMN IF NOT EXISTS cache_read_tokens integer NULL,
    ADD COLUMN IF NOT EXISTS cache_write_tokens integer NULL,
    ADD COLUMN IF NOT EXISTS uncached_prompt_tokens integer NULL;

COMMENT ON COLUMN public.ai_requests.cache_read_tokens IS
    'Prompt tokens served from the provider cache. NULL when the provider reported nothing.';
COMMENT ON COLUMN public.ai_requests.cache_write_tokens IS
    'Prompt tokens written to the provider cache. NULL when the provider reported nothing.';
COMMENT ON COLUMN public.ai_requests.uncached_prompt_tokens IS
    'Prompt tokens billed at the full input rate (no cache read or write). NULL when unknown.';

-- Same index as 20261013_000000_org_usage_stats.sql; repeated in case that one has
-- not been applied. On a large table, run it alone with CONCURRENTLY.
CREATE INDEX IF NOT EXISTS idx_ai_requests_project_created_at
    ON public.ai_requests (project_id, created_at DESC);

-- ─── 2. Organization usage export keys ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organization_usage_export_keys (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
    key_prefix      text NOT NULL,
    key_hash        text NOT NULL UNIQUE,
    scopes          text[] NOT NULL DEFAULT ARRAY['usage:read'],
    created_by      uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_used_at    timestamptz NULL,
    revoked_at      timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_org_usage_export_keys_org
    ON public.organization_usage_export_keys (organization_id)
    WHERE revoked_at IS NULL;

ALTER TABLE public.organization_usage_export_keys ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) reads or writes it.

-- ─── 3. FinOps push connections ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organization_finops_connections (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider              text NOT NULL CHECK (provider IN ('costgraph')),
    -- The destination's id for this stream (CostGraph: the fpc_… push connection).
    connection_id         text NOT NULL,
    -- Encrypted with lib/encryption (per-organization key). Never returned to clients.
    api_key_encrypted     text NOT NULL,
    api_key_hint          text NOT NULL,
    -- What fills the FOCUS SubAccountId column.
    sub_account           text NOT NULL DEFAULT 'project'
                              CHECK (sub_account IN ('project', 'end_user', 'tenant', 'none')),
    enabled               boolean NOT NULL DEFAULT true,
    -- Last UTC day fully sent with complete=true. The cron resumes from the day after.
    last_pushed_day       date NULL,
    -- First day of the last month re-sent after it closed (restatement pass).
    last_closed_month     date NULL,
    last_run_at           timestamptz NULL,
    last_run_status       text NULL CHECK (last_run_status IN ('ok', 'error')),
    last_run_error        text NULL,
    last_run_rows         integer NULL,
    created_by            uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, provider)
);

ALTER TABLE public.organization_finops_connections ENABLE ROW LEVEL SECURITY;
-- No policies: service role only. The console goes through server actions that
-- check owner/admin membership first.

-- ─── 4. FOCUS daily rollup ───────────────────────────────────────────────────

-- One row per UTC day × project × environment × upstream provider × model ×
-- endpoint family × sub-account, over [p_start, p_end). Rows with no tokens and no
-- cost (refusals, pre-provider errors) are left out: they cost nothing and a FinOps
-- tool has nothing to do with them. Ordered and paged deterministically so a push
-- can address each page by row offset.
--
-- p_sub_account: 'project' | 'end_user' | 'tenant' | 'none'.
CREATE OR REPLACE FUNCTION public.focus_usage_daily(
    p_project_ids uuid[],
    p_start       timestamptz,
    p_end         timestamptz,
    p_sub_account text,
    p_limit       integer,
    p_offset      integer
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    WITH base AS (
        SELECT
            (r.created_at AT TIME ZONE 'utc')::date AS day,
            r.project_id,
            COALESCE(r.environment, 'production')  AS environment,
            COALESCE(r.provider, 'unknown')        AS provider,
            COALESCE(r.model, 'unknown')           AS model,
            CASE
                WHEN r.endpoint ILIKE '%embed%' OR r.endpoint ILIKE '%memory%' THEN 'embeddings'
                WHEN r.endpoint ILIKE '%image%'                                 THEN 'images'
                WHEN r.endpoint ILIKE '%audio%' OR r.endpoint ILIKE '%speech%'
                  OR r.endpoint ILIKE '%transcri%' OR r.endpoint ILIKE '%voice%' THEN 'audio'
                WHEN r.endpoint ILIKE '%vision%'                                THEN 'vision'
                WHEN r.endpoint ILIKE '%document%'                              THEN 'documents'
                WHEN r.endpoint ILIKE '%moderation%'                            THEN 'moderation'
                WHEN r.endpoint ILIKE '%web%'                                   THEN 'web'
                ELSE 'chat'
            END AS endpoint_family,
            CASE p_sub_account
                WHEN 'project'  THEN r.project_id::text
                WHEN 'end_user' THEN NULLIF(r.end_user_id::text, '')
                WHEN 'tenant'   THEN r.tenant_id::text
                ELSE NULL
            END AS sub_account_id,
            COALESCE(r.prompt_tokens, 0)     AS prompt_tokens,
            COALESCE(r.completion_tokens, 0) AS completion_tokens,
            COALESCE(r.total_tokens, 0)      AS total_tokens,
            r.cache_read_tokens,
            r.cache_write_tokens,
            -- Legacy rows (and providers that report no cache) carry no split: the whole
            -- prompt was billed at the input rate as far as anyone recorded.
            COALESCE(
                r.uncached_prompt_tokens,
                CASE WHEN r.cache_read_tokens IS NULL AND r.cache_write_tokens IS NULL
                     THEN COALESCE(r.prompt_tokens, 0) END
            ) AS uncached_prompt_tokens,
            COALESCE(r.cencori_charge_usd, 0) AS charge_usd,
            COALESCE(r.provider_cost_usd, 0) AS provider_cost_usd
        FROM public.ai_requests r
        WHERE r.project_id = ANY (p_project_ids)
          AND r.created_at >= p_start
          AND r.created_at <  p_end
          AND (COALESCE(r.total_tokens, 0) > 0
               OR COALESCE(r.cencori_charge_usd, 0) > 0
               OR COALESCE(r.provider_cost_usd, 0) > 0)
    ),
    grouped AS (
        SELECT
            day, project_id, environment, provider, model, endpoint_family, sub_account_id,
            COUNT(*)                         AS requests,
            SUM(prompt_tokens)               AS prompt_tokens,
            SUM(completion_tokens)           AS completion_tokens,
            SUM(total_tokens)                AS total_tokens,
            SUM(cache_read_tokens)           AS cache_read_tokens,
            SUM(cache_write_tokens)          AS cache_write_tokens,
            SUM(uncached_prompt_tokens)      AS uncached_prompt_tokens,
            -- Requests whose input split is unknown; when > 0 the bucket sums undercount.
            COUNT(*) FILTER (WHERE uncached_prompt_tokens IS NULL) AS unsplit_requests,
            SUM(charge_usd)                  AS charge_usd,
            SUM(provider_cost_usd)           AS provider_cost_usd
        FROM base
        GROUP BY day, project_id, environment, provider, model, endpoint_family, sub_account_id
    ),
    page AS (
        SELECT g.*, p.name AS project_name
        FROM grouped g
        LEFT JOIN public.projects p ON p.id = g.project_id
        ORDER BY g.day, g.project_id, g.environment, g.provider, g.model,
                 g.endpoint_family, g.sub_account_id NULLS FIRST
        LIMIT GREATEST(p_limit, 1) + 1
        OFFSET GREATEST(p_offset, 0)
    )
    SELECT jsonb_build_object(
        'rows', COALESCE((
            SELECT jsonb_agg(to_jsonb(x) - 'rn' ORDER BY x.rn)
            FROM (SELECT page.*, row_number() OVER (
                      ORDER BY day, project_id, environment, provider, model,
                               endpoint_family, sub_account_id NULLS FIRST) AS rn
                  FROM page) x
            WHERE x.rn <= GREATEST(p_limit, 1)
        ), '[]'::jsonb),
        'has_more', (SELECT COUNT(*) FROM page) > GREATEST(p_limit, 1)
    );
$$;

COMMENT ON FUNCTION public.focus_usage_daily(uuid[], timestamptz, timestamptz, text, integer, integer) IS
    'FOCUS 1.2 daily usage rollup for the usage export and FinOps push. Service role only.';

REVOKE ALL ON FUNCTION public.focus_usage_daily(uuid[], timestamptz, timestamptz, text, integer, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.focus_usage_daily(uuid[], timestamptz, timestamptz, text, integer, integer)
    TO service_role;

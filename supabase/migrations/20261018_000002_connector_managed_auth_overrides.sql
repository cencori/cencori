-- Managed OAuth + parameter enrichment for the connector catalog
-- (gaps left after phase 1/2: zero-setup auth breadth and tool-quality curation).
-- `managed_auth` marks connectors whose OAuth client credentials ship with the
-- platform (env CENCORI_OAUTH_<SLUG>_*): customers authorize without BYO
-- client_id/secret. Gmail already runs this way. `param_overrides` is curated
-- additive metadata (descriptions/enums/required/drops) merged at import time
-- by applyParamOverrides — never executable, drift-safe by construction.
ALTER TABLE public.connectors ADD COLUMN managed_auth boolean NOT NULL DEFAULT false;
ALTER TABLE public.connectors ADD COLUMN param_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.connectors.managed_auth IS 'Platform-managed OAuth client credentials are available; customers authorize without BYO client credentials.';
COMMENT ON COLUMN public.connectors.param_overrides IS 'Curated per-operation parameter enrichment applied when an OpenAPI spec is imported.';

-- Gmail's managed client ships via env today; flip rows to true as each vendor
-- app is registered and its CENCORI_OAUTH_<SLUG>_* credentials land in env.
UPDATE public.connectors SET managed_auth = true WHERE slug = 'gmail';

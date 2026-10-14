-- CostGraph: connect with "Sign in with CostGraph" (OAuth) as well as a pasted API key.
--
-- A FinOps connection can now authenticate one of two ways:
--   api_key — the customer pastes a CostGraph key and the fpc_ connection id (live today);
--   oauth   — the customer clicks Connect CostGraph, signs in, picks a tenant; Cencori holds a
--             rotating refresh token and creates the push connection itself.
--
-- The OAuth path is gated by COSTGRAPH_OAUTH_ENABLED and waits on CostGraph for three things:
-- a focus:write OAuth scope, Bearer tokens on POST /tenant/billing/focus, and an endpoint that
-- creates a push connection. Until then an oauth row can exist without a connection_id, and the
-- nightly push skips it.
--
-- Additive and nullable, so the existing push keeps working whether or not this has run.

ALTER TABLE public.organization_finops_connections
    ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'api_key',
    ADD COLUMN IF NOT EXISTS costgraph_tenant_id text NULL,
    ADD COLUMN IF NOT EXISTS costgraph_tenant_name text NULL,
    ADD COLUMN IF NOT EXISTS oauth_access_token_encrypted text NULL,
    ADD COLUMN IF NOT EXISTS oauth_refresh_token_encrypted text NULL,
    ADD COLUMN IF NOT EXISTS oauth_access_expires_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS oauth_scope text NULL,
    ADD COLUMN IF NOT EXISTS oauth_subject text NULL,
    -- Who holds the right to refresh right now. CostGraph rotates refresh tokens and signs the
    -- user out if an old one is presented again, so two processes must never refresh at once.
    ADD COLUMN IF NOT EXISTS oauth_refresh_lease_until timestamptz NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'organization_finops_connections_auth_method_check'
    ) THEN
        ALTER TABLE public.organization_finops_connections
            ADD CONSTRAINT organization_finops_connections_auth_method_check
            CHECK (auth_method IN ('api_key', 'oauth'));
    END IF;
END $$;

-- An OAuth connection has no pasted key, and has no fpc_ id until CostGraph creates one.
ALTER TABLE public.organization_finops_connections
    ALTER COLUMN api_key_encrypted DROP NOT NULL,
    ALTER COLUMN api_key_hint DROP NOT NULL,
    ALTER COLUMN connection_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'organization_finops_connections_credentials_check'
    ) THEN
        ALTER TABLE public.organization_finops_connections
            ADD CONSTRAINT organization_finops_connections_credentials_check
            CHECK (
                (auth_method = 'api_key' AND api_key_encrypted IS NOT NULL AND connection_id IS NOT NULL)
                OR (auth_method = 'oauth' AND oauth_refresh_token_encrypted IS NOT NULL)
            );
    END IF;
END $$;

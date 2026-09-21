-- M0 Embedded Agents foundation
-- PRD docs/prds/CENCORI_EMBEDDED_AGENTS_PRD.md §13, RFC docs/prds/CENCORI_EMBEDDED_AGENTS_M0_RFC.md
-- Greenfield tables + nullable session scope columns. Service-role access only (no anon policies).

-- ── platform_tenants ──
CREATE TABLE IF NOT EXISTS public.platform_tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    external_id text NOT NULL,
    name text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleting','deleted')),
    region text NULL,
    retention_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
    rate_plan_id text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    suspended_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (project_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_platform_tenants_project ON public.platform_tenants(project_id);
CREATE INDEX IF NOT EXISTS idx_platform_tenants_status ON public.platform_tenants(project_id, status);

-- ── platform_users ──
CREATE TABLE IF NOT EXISTS public.platform_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id) ON DELETE CASCADE,
    external_id text NOT NULL,
    display_name text NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','deleted')),
    roles text[] NOT NULL DEFAULT '{}',
    groups text[] NOT NULL DEFAULT '{}',
    rate_plan_id text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_platform_users_tenant ON public.platform_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_users_project ON public.platform_users(project_id);

-- ── provider_connections (public M0 write path; unified over legacy provider_keys/custom_providers) ──
CREATE TABLE IF NOT EXISTS public.provider_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    provider text NOT NULL,
    api_format text NOT NULL DEFAULT 'openai' CHECK (api_format IN ('openai','anthropic','openai-compatible','anthropic-compatible')),
    base_url text NULL,
    encrypted_key_ref text NULL,
    key_hint text NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','unhealthy')),
    last_tested_at timestamptz NULL,
    last_synced_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_connections_project ON public.provider_connections(project_id);

-- ── provider_connection_models (synced + manually registered rows feeding /v1/models) ──
CREATE TABLE IF NOT EXISTS public.provider_connection_models (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    provider_connection_id uuid NOT NULL REFERENCES public.provider_connections(id) ON DELETE CASCADE,
    upstream_model_id text NOT NULL,
    display_name text NULL,
    capabilities text[] NOT NULL DEFAULT '{chat}',
    context_window integer NOT NULL DEFAULT 0,
    lifecycle_status text NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active','preview','deprecated','retired')),
    availability_status text NOT NULL DEFAULT 'pending' CHECK (availability_status IN ('pending','available','unavailable')),
    unavailable_reason text NULL,
    pricing_status text NOT NULL DEFAULT 'unknown' CHECK (pricing_status IN ('priced','unpriced','custom','unknown')),
    upstream_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_connection_id, upstream_model_id)
);
CREATE INDEX IF NOT EXISTS idx_provider_connection_models_conn ON public.provider_connection_models(provider_connection_id);
CREATE INDEX IF NOT EXISTS idx_provider_connection_models_project ON public.provider_connection_models(project_id);

-- ── provider_model_syncs (durable preview/apply) ──
CREATE TABLE IF NOT EXISTS public.provider_model_syncs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    provider_connection_id uuid NOT NULL REFERENCES public.provider_connections(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','applying','applied','failed','expired')),
    upstream_etag text NULL,
    diff_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    snapshot_hash text NULL,
    expires_at timestamptz NULL,
    applied_at timestamptz NULL,
    idempotency_key text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_connection_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_provider_model_syncs_conn ON public.provider_model_syncs(provider_connection_id);

-- ── sessions scope (immutable after creation; enforced app-side) ──
ALTER TABLE public.sessions
    ADD COLUMN IF NOT EXISTS tenant_id uuid NULL REFERENCES public.platform_tenants(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS external_user_id text NULL,
    ADD COLUMN IF NOT EXISTS installation_id text NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON public.sessions(project_id, tenant_id);

-- ── updated_at triggers ──
CREATE OR REPLACE FUNCTION update_embedded_m0_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_platform_tenants_updated_at ON public.platform_tenants;
CREATE TRIGGER set_platform_tenants_updated_at BEFORE UPDATE ON public.platform_tenants
    FOR EACH ROW EXECUTE FUNCTION update_embedded_m0_updated_at();

DROP TRIGGER IF EXISTS set_platform_users_updated_at ON public.platform_users;
CREATE TRIGGER set_platform_users_updated_at BEFORE UPDATE ON public.platform_users
    FOR EACH ROW EXECUTE FUNCTION update_embedded_m0_updated_at();

DROP TRIGGER IF EXISTS set_provider_connections_updated_at ON public.provider_connections;
CREATE TRIGGER set_provider_connections_updated_at BEFORE UPDATE ON public.provider_connections
    FOR EACH ROW EXECUTE FUNCTION update_embedded_m0_updated_at();

DROP TRIGGER IF EXISTS set_provider_connection_models_updated_at ON public.provider_connection_models;
CREATE TRIGGER set_provider_connection_models_updated_at BEFORE UPDATE ON public.provider_connection_models
    FOR EACH ROW EXECUTE FUNCTION update_embedded_m0_updated_at();

-- ── RLS: service-role only ──
ALTER TABLE public.platform_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_connection_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_model_syncs ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated get zero rows; service-role bypasses RLS.

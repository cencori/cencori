-- M1 Embedded Agents slice: versions, installations, knowledge, runs, webhook deliveries
-- PRD §13, RFC docs/prds/CENCORI_EMBEDDED_AGENTS_M1_RFC.md
-- Service-role access only (no anon policies).

-- ── agent_versions (immutable once published) ──
CREATE TABLE IF NOT EXISTS public.agent_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    version text NOT NULL,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','validating','ready_for_review','published','deprecated','retired')),
    config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    requirements_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    checksum text NULL,
    created_by text NULL,
    reviewed_by text NULL,
    published_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (agent_id, version)
);
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent ON public.agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_versions_status ON public.agent_versions(agent_id, status);

ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS stable_version_id uuid NULL REFERENCES public.agent_versions(id) ON DELETE SET NULL;

-- ── agent_installations (tenant-scoped activation) ──
CREATE TABLE IF NOT EXISTS public.agent_installations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES public.platform_tenants(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    agent_version_id uuid NULL REFERENCES public.agent_versions(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
    update_channel text NOT NULL DEFAULT 'pinned' CHECK (update_channel IN ('pinned','stable')),
    overlay_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    approval_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
    budget jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, agent_id)
);
CREATE INDEX IF NOT EXISTS idx_installations_tenant ON public.agent_installations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_installations_project ON public.agent_installations(project_id);

CREATE TABLE IF NOT EXISTS public.installation_knowledge_bases (
    installation_id uuid NOT NULL REFERENCES public.agent_installations(id) ON DELETE CASCADE,
    knowledge_base_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (installation_id, knowledge_base_id)
);

CREATE TABLE IF NOT EXISTS public.installation_connections (
    installation_id uuid NOT NULL REFERENCES public.agent_installations(id) ON DELETE CASCADE,
    connection_id text NOT NULL,
    allowed_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (installation_id, connection_id)
);

-- ── knowledge ──
CREATE TABLE IF NOT EXISTS public.knowledge_bases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tenant_id uuid NULL REFERENCES public.platform_tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    scope_type text NOT NULL DEFAULT 'tenant' CHECK (scope_type IN ('platform','tenant','group')),
    region text NULL,
    retention_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_project ON public.knowledge_bases(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_tenant ON public.knowledge_bases(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.knowledge_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_base_id uuid NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
    source_type text NOT NULL CHECK (source_type IN ('inline','file','url')),
    mime text NULL,
    bytes integer NULL,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','ready','failed','stale')),
    checksum text NULL,
    content_ref text NULL,
    error text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_kb ON public.knowledge_sources(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_status ON public.knowledge_sources(status);

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    knowledge_base_id uuid NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
    source_id uuid NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
    tenant_id uuid NULL REFERENCES public.platform_tenants(id) ON DELETE CASCADE,
    ord integer NOT NULL,
    page integer NULL,
    content text NOT NULL,
    embedding vector(1536) NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON public.knowledge_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_kb ON public.knowledge_chunks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_project ON public.knowledge_chunks(project_id, tenant_id);

CREATE TABLE IF NOT EXISTS public.knowledge_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_base_id uuid NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
    subject_type text NOT NULL CHECK (subject_type IN ('installation','group','role','user')),
    subject_id text NOT NULL,
    permissions text[] NOT NULL DEFAULT '{read}',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (knowledge_base_id, subject_type, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_grants_kb ON public.knowledge_grants(knowledge_base_id);

-- ── embedded_runs ──
CREATE TABLE IF NOT EXISTS public.embedded_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tenant_id uuid NULL REFERENCES public.platform_tenants(id) ON DELETE SET NULL,
    external_user_id text NULL,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    agent_version_id uuid NULL REFERENCES public.agent_versions(id) ON DELETE SET NULL,
    installation_id uuid NULL REFERENCES public.agent_installations(id) ON DELETE SET NULL,
    session_id uuid NULL REFERENCES public.sessions(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued','running','requires_action','completed','failed','cancelled','expired')),
    input_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
    output_ref jsonb NULL,
    idempotency_key text NULL,
    error text NULL,
    started_at timestamptz NULL,
    completed_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (project_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_embedded_runs_project ON public.embedded_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_embedded_runs_tenant ON public.embedded_runs(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_embedded_runs_status ON public.embedded_runs(status);

CREATE TABLE IF NOT EXISTS public.embedded_run_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.embedded_runs(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_run_events_run ON public.embedded_run_events(run_id, created_at);

-- ── webhook_deliveries ──
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id uuid NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
    attempt_count integer NOT NULL DEFAULT 0,
    response_code integer NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON public.webhook_deliveries(endpoint_id);

-- ── updated_at triggers ──
CREATE OR REPLACE FUNCTION update_embedded_m1_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_agent_versions_updated_at ON public.agent_versions;
CREATE TRIGGER set_agent_versions_updated_at BEFORE UPDATE ON public.agent_versions
    FOR EACH ROW EXECUTE FUNCTION update_embedded_m1_updated_at();

DROP TRIGGER IF EXISTS set_installations_updated_at ON public.agent_installations;
CREATE TRIGGER set_installations_updated_at BEFORE UPDATE ON public.agent_installations
    FOR EACH ROW EXECUTE FUNCTION update_embedded_m1_updated_at();

DROP TRIGGER IF EXISTS set_kb_updated_at ON public.knowledge_bases;
CREATE TRIGGER set_kb_updated_at BEFORE UPDATE ON public.knowledge_bases
    FOR EACH ROW EXECUTE FUNCTION update_embedded_m1_updated_at();

DROP TRIGGER IF EXISTS set_ks_updated_at ON public.knowledge_sources;
CREATE TRIGGER set_ks_updated_at BEFORE UPDATE ON public.knowledge_sources
    FOR EACH ROW EXECUTE FUNCTION update_embedded_m1_updated_at();

DROP TRIGGER IF EXISTS set_runs_updated_at ON public.embedded_runs;
CREATE TRIGGER set_runs_updated_at BEFORE UPDATE ON public.embedded_runs
    FOR EACH ROW EXECUTE FUNCTION update_embedded_m1_updated_at();

-- ── knowledge vector search RPC ──
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
    p_knowledge_base_id uuid,
    p_query_embedding vector(1536),
    p_match_count integer DEFAULT 5
)
RETURNS TABLE (id uuid, source_id uuid, ord integer, page integer, content text, similarity float)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id, kc.source_id, kc.ord, kc.page, kc.content,
        (1 - (kc.embedding <=> p_query_embedding))::float AS similarity
    FROM public.knowledge_chunks kc
    WHERE kc.knowledge_base_id = p_knowledge_base_id
      AND kc.embedding IS NOT NULL
    ORDER BY kc.embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$;

-- ── RLS: service-role only ──
ALTER TABLE public.agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedded_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedded_run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

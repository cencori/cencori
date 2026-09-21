-- M2 Embedded Agents: connectors, tool connections, OAuth states, MCP servers, actions
-- PRD §8.7-8.8, RFC docs/prds/CENCORI_EMBEDDED_AGENTS_M2_RFC.md
-- Service-role access only (no anon policies).

-- ── connectors (reusable integration types) ──
CREATE TABLE IF NOT EXISTS public.connectors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    auth_type text NOT NULL CHECK (auth_type IN ('oauth2','api_key','none')),
    oauth_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    default_scopes text[] NOT NULL DEFAULT '{}',
    mcp_transport text NULL CHECK (mcp_transport IN ('streamable-http','sse')),
    risk_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── tool_connections (tenant/user-owned credentialed instances) ──
CREATE TABLE IF NOT EXISTS public.tool_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tenant_id uuid NULL REFERENCES public.platform_tenants(id) ON DELETE CASCADE,
    external_user_id text NULL,
    connector_id uuid NULL REFERENCES public.connectors(id) ON DELETE SET NULL,
    connector_slug text NOT NULL DEFAULT 'gmail',
    owner_type text NOT NULL CHECK (owner_type IN ('tenant','user','platform')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','expired','revoked','error')),
    encrypted_access_ref text NULL,
    encrypted_refresh_ref text NULL,
    key_hint text NULL,
    scopes text[] NOT NULL DEFAULT '{}',
    tool_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    expires_at timestamptz NULL,
    last_tested_at timestamptz NULL,
    last_error text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tool_connections_project ON public.tool_connections(project_id);
CREATE INDEX IF NOT EXISTS idx_tool_connections_tenant ON public.tool_connections(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tool_connections_status ON public.tool_connections(status);

-- ── oauth_states (authorize flow, short-lived) ──
CREATE TABLE IF NOT EXISTS public.oauth_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    state text NOT NULL UNIQUE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    connection_id uuid NOT NULL REFERENCES public.tool_connections(id) ON DELETE CASCADE,
    connector_slug text NOT NULL,
    code_verifier text NULL,
    redirect_uri text NOT NULL,
    scopes text[] NOT NULL DEFAULT '{}',
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);

-- ── mcp_servers (remote MCP connections) ──
CREATE TABLE IF NOT EXISTS public.mcp_servers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tenant_id uuid NULL REFERENCES public.platform_tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    url text NOT NULL,
    transport text NOT NULL DEFAULT 'streamable-http' CHECK (transport IN ('streamable-http','sse')),
    auth_connection_id uuid NULL REFERENCES public.tool_connections(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','unhealthy')),
    tool_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_discovered_at timestamptz NULL,
    last_error text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_project ON public.mcp_servers(project_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_tenant ON public.mcp_servers(tenant_id) WHERE tenant_id IS NOT NULL;

-- ── actions (unified approval/execution index) ──
CREATE TABLE IF NOT EXISTS public.actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tenant_id uuid NULL REFERENCES public.platform_tenants(id) ON DELETE SET NULL,
    run_id uuid NULL REFERENCES public.embedded_runs(id) ON DELETE SET NULL,
    session_id uuid NULL REFERENCES public.sessions(id) ON DELETE SET NULL,
    turn_number integer NULL,
    tool_name text NOT NULL,
    risk_level text NOT NULL DEFAULT 'write' CHECK (risk_level IN ('read','write','destructive')),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected','expired','executing','executed','failed')),
    sanitized_arguments jsonb NOT NULL DEFAULT '{}'::jsonb,
    approval_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
    expires_at timestamptz NULL,
    approved_by text NULL,
    resolved_at timestamptz NULL,
    execution_key text NOT NULL UNIQUE,
    result jsonb NULL,
    error text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_actions_project ON public.actions(project_id);
CREATE INDEX IF NOT EXISTS idx_actions_tenant ON public.actions(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actions_status ON public.actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_session ON public.actions(session_id, turn_number) WHERE session_id IS NOT NULL;

-- ── seed connectors ──
INSERT INTO public.connectors (slug, name, auth_type, oauth_config, default_scopes, risk_defaults)
VALUES
    ('gmail', 'Gmail', 'oauth2',
     '{"auth_url":"https://accounts.google.com/o/oauth2/v2/auth","token_url":"https://oauth2.googleapis.com/token"}'::jsonb,
     '{https://www.googleapis.com/auth/gmail.send}'::text[],
     '{"send":{"risk":"write","approval":"required","idempotent":false}}'::jsonb),
    ('generic-mcp', 'Remote MCP Server', 'none', '{}'::jsonb, '{}'::text[],
     '{"default":{"risk":"write","approval":"required","idempotent":false}}'::jsonb),
    ('webhook-function', 'Customer Webhook Function', 'none', '{}'::jsonb, '{}'::text[],
     '{"default":{"risk":"write","approval":"required","idempotent":true}}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ── updated_at triggers ──
CREATE OR REPLACE FUNCTION update_embedded_m2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_connectors_updated_at ON public.connectors;
CREATE TRIGGER set_connectors_updated_at BEFORE UPDATE ON public.connectors
    FOR EACH ROW EXECUTE FUNCTION update_embedded_m2_updated_at();

DROP TRIGGER IF EXISTS set_tool_connections_updated_at ON public.tool_connections;
CREATE TRIGGER set_tool_connections_updated_at BEFORE UPDATE ON public.tool_connections
    FOR EACH ROW EXECUTE FUNCTION update_embedded_m2_updated_at();

DROP TRIGGER IF EXISTS set_mcp_servers_updated_at ON public.mcp_servers;
CREATE TRIGGER set_mcp_servers_updated_at BEFORE UPDATE ON public.mcp_servers
    FOR EACH ROW EXECUTE FUNCTION update_embedded_m2_updated_at();

DROP TRIGGER IF EXISTS set_actions_updated_at ON public.actions;
CREATE TRIGGER set_actions_updated_at BEFORE UPDATE ON public.actions
    FOR EACH ROW EXECUTE FUNCTION update_embedded_m2_updated_at();

-- ── RLS: service-role only ──
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

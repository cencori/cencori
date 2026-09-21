-- M3 Embedded Agents: publishing visibility + usage attribution dimensions
-- PRD §8.3, §8.10, RFC docs/prds/CENCORI_EMBEDDED_AGENTS_M3_RFC.md

-- ── agent version visibility ──
ALTER TABLE public.agent_versions
    ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private','tenant','unlisted','public'));
CREATE INDEX IF NOT EXISTS idx_agent_versions_visibility
    ON public.agent_versions(project_id, status, visibility);

-- ── ai_requests attribution dimensions (nullable; pre-migration rows stay null) ──
ALTER TABLE public.ai_requests
    ADD COLUMN IF NOT EXISTS tenant_id uuid NULL REFERENCES public.platform_tenants(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS agent_id uuid NULL REFERENCES public.agents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS installation_id uuid NULL REFERENCES public.agent_installations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS session_id uuid NULL REFERENCES public.sessions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS run_id uuid NULL REFERENCES public.embedded_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_requests_tenant ON public.ai_requests(project_id, tenant_id, created_at DESC) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_requests_agent ON public.ai_requests(project_id, agent_id, created_at DESC) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_requests_installation ON public.ai_requests(project_id, installation_id, created_at DESC) WHERE installation_id IS NOT NULL;

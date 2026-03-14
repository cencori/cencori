-- Prompt Registry: versioned, deployable prompts for the AI Gateway

-- Named prompt entities
CREATE TABLE IF NOT EXISTS public.prompt_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    active_version_id UUID,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prompt_registry_project_name UNIQUE (project_id, name),
    CONSTRAINT uq_prompt_registry_project_slug UNIQUE (project_id, slug)
);

CREATE INDEX idx_prompt_registry_project ON public.prompt_registry(project_id);

-- Immutable version records
CREATE TABLE IF NOT EXISTS public.prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES public.prompt_registry(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    model_hint TEXT,
    temperature NUMERIC,
    max_tokens INTEGER,
    variables TEXT[] DEFAULT '{}',
    change_message TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prompt_version UNIQUE (prompt_id, version)
);

CREATE INDEX idx_prompt_versions_prompt ON public.prompt_versions(prompt_id, version DESC);

-- Add FK for active_version_id
ALTER TABLE public.prompt_registry
    ADD CONSTRAINT prompt_registry_active_version_id_fkey
    FOREIGN KEY (active_version_id) REFERENCES public.prompt_versions(id) ON DELETE SET NULL;

-- Usage tracking
CREATE TABLE IF NOT EXISTS public.prompt_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    prompt_id UUID NOT NULL REFERENCES public.prompt_registry(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.prompt_versions(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    api_key_id UUID,
    request_id TEXT,
    variables_used JSONB,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prompt_usage_project ON public.prompt_usage_log(project_id, created_at DESC);
CREATE INDEX idx_prompt_usage_prompt ON public.prompt_usage_log(prompt_id, created_at DESC);

-- RLS
ALTER TABLE public.prompt_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage prompt_registry for their projects"
    ON public.prompt_registry FOR ALL USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.organization_members om ON om.organization_id = p.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage prompt_versions for their projects"
    ON public.prompt_versions FOR ALL USING (
        prompt_id IN (
            SELECT pr.id FROM public.prompt_registry pr
            JOIN public.projects p ON p.id = pr.project_id
            JOIN public.organization_members om ON om.organization_id = p.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view prompt_usage_log for their projects"
    ON public.prompt_usage_log FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.organization_members om ON om.organization_id = p.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can insert prompt_usage_log"
    ON public.prompt_usage_log FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role full access on prompt_registry"
    ON public.prompt_registry FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on prompt_versions"
    ON public.prompt_versions FOR ALL USING (true) WITH CHECK (true);

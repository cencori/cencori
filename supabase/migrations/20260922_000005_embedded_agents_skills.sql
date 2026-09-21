-- v1.1 skills library: passive Markdown/text skills, staged imports, version refs.
-- PRD §8.3.2. Alpha: passive content only — no executable packages.
-- Service-role access only (no anon policies).

-- ── skills (stable identity) ──
CREATE TABLE IF NOT EXISTS public.skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tenant_id uuid NULL REFERENCES public.platform_tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    description text NULL,
    visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','tenant','public')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
    created_by text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (project_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_skills_project ON public.skills(project_id);
CREATE INDEX IF NOT EXISTS idx_skills_tenant ON public.skills(tenant_id) WHERE tenant_id IS NOT NULL;

-- ── skill_versions (immutable once published) ──
CREATE TABLE IF NOT EXISTS public.skill_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    version text NOT NULL,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','validating','ready_for_review','published','deprecated')),
    content text NOT NULL,
    source_type text NOT NULL DEFAULT 'authored' CHECK (source_type IN ('authored','imported')),
    source_uri text NULL,
    source_revision text NULL,
    checksum text NULL,
    scan_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_by text NULL,
    reviewed_by text NULL,
    published_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (skill_id, version)
);
CREATE INDEX IF NOT EXISTS idx_skill_versions_skill ON public.skill_versions(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_versions_status ON public.skill_versions(skill_id, status);

-- ── skill_imports (staged source → scan → review → publish) ──
CREATE TABLE IF NOT EXISTS public.skill_imports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tenant_id uuid NULL REFERENCES public.platform_tenants(id) ON DELETE CASCADE,
    source_type text NOT NULL CHECK (source_type IN ('repo','url','upload','paste')),
    source_ref text NOT NULL,
    status text NOT NULL DEFAULT 'staged'
        CHECK (status IN ('staged','scanning','ready_for_review','published','rejected','failed')),
    normalized_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
    scan_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
    checksum text NULL,
    created_by text NULL,
    reviewed_by text NULL,
    published_skill_version_id uuid NULL REFERENCES public.skill_versions(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skill_imports_project ON public.skill_imports(project_id);
CREATE INDEX IF NOT EXISTS idx_skill_imports_status ON public.skill_imports(status);

-- ── agent_version_skills (version pins skill versions) ──
CREATE TABLE IF NOT EXISTS public.agent_version_skills (
    agent_version_id uuid NOT NULL REFERENCES public.agent_versions(id) ON DELETE CASCADE,
    skill_version_id uuid NOT NULL REFERENCES public.skill_versions(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (agent_version_id, skill_version_id)
);

-- ── updated_at triggers ──
CREATE OR REPLACE FUNCTION update_embedded_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_skills_updated_at ON public.skills;
CREATE TRIGGER set_skills_updated_at BEFORE UPDATE ON public.skills
    FOR EACH ROW EXECUTE FUNCTION update_embedded_skills_updated_at();

DROP TRIGGER IF EXISTS set_skill_versions_updated_at ON public.skill_versions;
CREATE TRIGGER set_skill_versions_updated_at BEFORE UPDATE ON public.skill_versions
    FOR EACH ROW EXECUTE FUNCTION update_embedded_skills_updated_at();

DROP TRIGGER IF EXISTS set_skill_imports_updated_at ON public.skill_imports;
CREATE TRIGGER set_skill_imports_updated_at BEFORE UPDATE ON public.skill_imports
    FOR EACH ROW EXECUTE FUNCTION update_embedded_skills_updated_at();

-- ── RLS: service-role only ──
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_version_skills ENABLE ROW LEVEL SECURITY;

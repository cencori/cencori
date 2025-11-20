-- =====================================================
-- Many-to-Many GitHub Installations Schema
-- =====================================================
-- This script refactors the GitHub App installation schema
-- to allow one installation to be linked to multiple organizations.
--
-- Run this in your Supabase SQL Editor.
-- =====================================================

-- 1. Create the new link table
CREATE TABLE IF NOT EXISTS public.organization_github_installations (
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    installation_id BIGINT REFERENCES public.github_app_installations(installation_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (organization_id, installation_id)
);

-- 2. Migrate existing data
-- We take the existing organization_id from github_app_installations and create a link
INSERT INTO public.organization_github_installations (organization_id, installation_id)
SELECT organization_id, installation_id
FROM public.github_app_installations
WHERE organization_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Make organization_id nullable in the original table
-- We keep it for now to avoid breaking other queries immediately, but it should be considered deprecated
ALTER TABLE public.github_app_installations
ALTER COLUMN organization_id DROP NOT NULL;

-- 4. Enable Row Level Security
ALTER TABLE public.organization_github_installations ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS Policies

-- Policy: Users can view links for organizations they own
CREATE POLICY "Users can view installation links for their organizations"
ON public.organization_github_installations
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.organizations
        WHERE organizations.id = organization_github_installations.organization_id
        AND organizations.owner_id = auth.uid()
    )
);

-- Policy: Users can create links for organizations they own
CREATE POLICY "Users can create installation links for their organizations"
ON public.organization_github_installations
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organizations
        WHERE organizations.id = organization_github_installations.organization_id
        AND organizations.owner_id = auth.uid()
    )
);

-- Policy: Users can delete links for organizations they own
CREATE POLICY "Users can delete installation links for their organizations"
ON public.organization_github_installations
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.organizations
        WHERE organizations.id = organization_github_installations.organization_id
        AND organizations.owner_id = auth.uid()
    )
);

-- 6. Add comments
COMMENT ON TABLE public.organization_github_installations IS 'Links Cencori Organizations to GitHub App Installations (Many-to-Many)';

-- Fix RLS Policies for Agent Deployment (Comprehensive)

-- 1. Agent Configs: Ensure Users can INSERT and UPDATE
DROP POLICY IF EXISTS "Users can create configs for their project agents" ON public.agent_configs;
CREATE POLICY "Users can create configs for their project agents"
    ON public.agent_configs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.agents a
            JOIN public.projects p ON a.project_id = p.id
            WHERE a.id = agent_configs.agent_id
            AND auth.uid() IN (
                SELECT user_id FROM public.organization_members
                WHERE organization_id = p.organization_id
            )
        )
    );

DROP POLICY IF EXISTS "Users can update configs for their project agents" ON public.agent_configs;
CREATE POLICY "Users can update configs for their project agents"
    ON public.agent_configs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.agents a
            JOIN public.projects p ON a.project_id = p.id
            WHERE a.id = agent_configs.agent_id
            AND auth.uid() IN (
                SELECT user_id FROM public.organization_members
                WHERE organization_id = p.organization_id
            )
        )
    );

-- 2. API Keys: Ensure Users can INSERT
DROP POLICY IF EXISTS "Users can create API keys for their projects" ON public.api_keys;
CREATE POLICY "Users can create API keys for their projects"
    ON public.api_keys FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = api_keys.project_id
            AND auth.uid() IN (
                SELECT user_id FROM public.organization_members
                WHERE organization_id = p.organization_id
            )
        )
    );

-- Harden RLS Policies (Production Audit Fix)
-- Replace permissive USING(true) policies with proper scoping

-- 1. Agent Configs: Only org members can read configs
DROP POLICY IF EXISTS "Agents can read their own config" ON public.agent_configs;
CREATE POLICY "Org members can read agent configs"
    ON public.agent_configs FOR SELECT
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

-- 2. Agent Sessions: Only org members can manage sessions
DROP POLICY IF EXISTS "Agents can manage their sessions" ON public.agent_sessions;
CREATE POLICY "Org members can manage agent sessions"
    ON public.agent_sessions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.agents a
            JOIN public.projects p ON a.project_id = p.id
            WHERE a.id = agent_sessions.agent_id
            AND auth.uid() IN (
                SELECT user_id FROM public.organization_members
                WHERE organization_id = p.organization_id
            )
        )
    );

-- 3. Agent Actions: Scoped INSERT (service role can still bypass RLS)
DROP POLICY IF EXISTS "Agents can insert actions" ON public.agent_actions;
CREATE POLICY "Org members can insert agent actions"
    ON public.agent_actions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.agents a
            JOIN public.projects p ON a.project_id = p.id
            WHERE a.id = agent_actions.agent_id
            AND auth.uid() IN (
                SELECT user_id FROM public.organization_members
                WHERE organization_id = p.organization_id
            )
        )
    );

-- 4. Agent Actions: Scoped SELECT for live feed
DROP POLICY IF EXISTS "Users can view their agent actions" ON public.agent_actions;
CREATE POLICY "Org members can view agent actions"
    ON public.agent_actions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.agents a
            JOIN public.projects p ON a.project_id = p.id
            WHERE a.id = agent_actions.agent_id
            AND auth.uid() IN (
                SELECT user_id FROM public.organization_members
                WHERE organization_id = p.organization_id
            )
        )
    );

-- 5. Agent Actions: Scoped UPDATE for approve/reject
DROP POLICY IF EXISTS "Users can approve/reject their agent actions" ON public.agent_actions;
CREATE POLICY "Org members can update agent actions"
    ON public.agent_actions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.agents a
            JOIN public.projects p ON a.project_id = p.id
            WHERE a.id = agent_actions.agent_id
            AND auth.uid() IN (
                SELECT user_id FROM public.organization_members
                WHERE organization_id = p.organization_id
            )
        )
    );

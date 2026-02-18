-- OpenClaw Gateway Migration
-- Supports "Remote Brain" Architecture (Phase 1)

-- 1. Agent Configurations (The Brain)
-- Stores the model, system prompt, and settings that the local agent should use.
CREATE TABLE IF NOT EXISTS public.agent_configs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
    model text NOT NULL DEFAULT 'gpt-4o',
    system_prompt text,
    temperature float DEFAULT 0.7,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(agent_id)
);

-- 2. Agent Sessions (The Connection)
-- Tracks active heartbeats and connection details from local agents.
CREATE TABLE IF NOT EXISTS public.agent_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
    socket_id text, -- Supabase Realtime socket ID
    status text DEFAULT 'offline', -- 'online', 'offline', 'busy'
    last_heartbeat timestamptz DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb, -- OS, IP, Version
    created_at timestamptz DEFAULT now()
);

-- 3. Agent Actions (Shadow Mode Queue)
-- Stores requested actions for manual approval.
CREATE TABLE IF NOT EXISTS public.agent_actions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
    session_id uuid REFERENCES public.agent_sessions(id) ON DELETE SET NULL,
    type text NOT NULL, -- 'tool_call', 'reasoning', 'error'
    payload jsonb NOT NULL, -- Tool name, arguments
    screenshot_url text, -- Context for the action
    status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'executed', 'failed'
    approved_at timestamptz,
    executed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 4. User Keys (BYOK Vault)
-- Securely stores user API keys. In a real production app, use Vault.
-- Here we rely on RLS and standard encryption if possible, or just strict RLS for the prototype.
CREATE TABLE IF NOT EXISTS public.user_keys (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    provider text NOT NULL, -- 'openai', 'anthropic', 'google'
    key_ciphertext text NOT NULL, -- Encrypted key
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, provider)
);

-- RLS Policies

-- Agent Configs: Users can view/edit configs for agents in their project.
ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view configs for their project agents"
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

CREATE POLICY "Agents can read their own config"
    ON public.agent_configs FOR SELECT
    USING (true); -- TODO: Tighten this with Service Role or Agent Authentication Token

-- Agent Sessions: Agents write heartbeats, Users read status.
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sessions"
    ON public.agent_sessions FOR SELECT
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

CREATE POLICY "Agents can manage their sessions"
    ON public.agent_sessions FOR ALL
    USING (true); -- TODO: Tighten

-- Agent Actions: Agents insert requests, Users update status (approve/reject).
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view actions"
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

CREATE POLICY "Agents can insert actions"
    ON public.agent_actions FOR INSERT
    WITH CHECK (true); -- TODO: Tighten

CREATE POLICY "Users can approve/reject actions"
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

-- User Keys: STRICT Security. Only the user can manage their keys.
ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own keys"
    ON public.user_keys FOR ALL
    USING (auth.uid() = user_id);

-- Cencori Sessions: event-sourced durable execution for AI agents
-- Adds sessions + session_events tables, indexes, RLS policies

-- ── sessions ──

CREATE TABLE IF NOT EXISTS public.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed', 'failed')),
    agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
    last_turn_number integer NOT NULL DEFAULT 0,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_organization ON sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);

-- ── session_events ──

CREATE TABLE IF NOT EXISTS public.session_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    turn_number integer NOT NULL,
    sequence integer NOT NULL,
    event_type text NOT NULL
        CHECK (event_type IN (
            'turn.started',
            'output_text.delta',
            'tool_call.started',
            'tool_call.completed',
            'turn.paused',
            'turn.resumed',
            'turn.completed'
        )),
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_events_replay
    ON session_events(session_id, turn_number, sequence);
CREATE INDEX IF NOT EXISTS idx_session_events_pending_approval
    ON session_events(session_id, event_type)
    WHERE event_type = 'turn.paused';

-- ── RLS (sessions) ──

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sessions for their projects"
    ON public.sessions FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN organizations o ON p.organization_id = o.id
            JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create sessions for their projects"
    ON public.sessions FOR INSERT WITH CHECK (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN organizations o ON p.organization_id = o.id
            JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update sessions for their projects"
    ON public.sessions FOR UPDATE USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN organizations o ON p.organization_id = o.id
            JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete sessions for their projects"
    ON public.sessions FOR DELETE USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN organizations o ON p.organization_id = o.id
            JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

-- ── RLS (session_events) ──

ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view session_events for their projects"
    ON public.session_events FOR SELECT USING (
        session_id IN (
            SELECT s.id FROM sessions s
            JOIN projects p ON s.project_id = p.id
            JOIN organizations o ON p.organization_id = o.id
            JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert session_events for their projects"
    ON public.session_events FOR INSERT WITH CHECK (
        session_id IN (
            SELECT s.id FROM sessions s
            JOIN projects p ON s.project_id = p.id
            JOIN organizations o ON p.organization_id = o.id
            JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

-- ── updated_at trigger ──

CREATE OR REPLACE FUNCTION update_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_sessions_updated_at ON public.sessions;
CREATE TRIGGER set_sessions_updated_at
    BEFORE UPDATE ON public.sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_sessions_updated_at();

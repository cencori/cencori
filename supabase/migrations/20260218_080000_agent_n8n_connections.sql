-- n8n Control-Plane connection per agent
-- Stores encrypted n8n API credentials for dashboard-managed connectivity.

CREATE TABLE IF NOT EXISTS public.agent_n8n_connections (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE UNIQUE,
    base_url text NOT NULL,
    api_key_encrypted text NOT NULL,
    workspace_id text,
    connection_status text NOT NULL DEFAULT 'disconnected',
    last_tested_at timestamptz,
    last_error text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_n8n_connections_agent_id
    ON public.agent_n8n_connections(agent_id);

ALTER TABLE public.agent_n8n_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view n8n connections"
    ON public.agent_n8n_connections FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.agents a
            JOIN public.projects p ON p.id = a.project_id
            WHERE a.id = agent_n8n_connections.agent_id
              AND auth.uid() IN (
                  SELECT user_id
                  FROM public.organization_members
                  WHERE organization_id = p.organization_id
              )
        )
    );

CREATE POLICY "Org members can insert n8n connections"
    ON public.agent_n8n_connections FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.agents a
            JOIN public.projects p ON p.id = a.project_id
            WHERE a.id = agent_n8n_connections.agent_id
              AND auth.uid() IN (
                  SELECT user_id
                  FROM public.organization_members
                  WHERE organization_id = p.organization_id
              )
        )
    );

CREATE POLICY "Org members can update n8n connections"
    ON public.agent_n8n_connections FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.agents a
            JOIN public.projects p ON p.id = a.project_id
            WHERE a.id = agent_n8n_connections.agent_id
              AND auth.uid() IN (
                  SELECT user_id
                  FROM public.organization_members
                  WHERE organization_id = p.organization_id
              )
        )
    );

CREATE POLICY "Org members can delete n8n connections"
    ON public.agent_n8n_connections FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM public.agents a
            JOIN public.projects p ON p.id = a.project_id
            WHERE a.id = agent_n8n_connections.agent_id
              AND auth.uid() IN (
                  SELECT user_id
                  FROM public.organization_members
                  WHERE organization_id = p.organization_id
              )
        )
    );

CREATE OR REPLACE FUNCTION update_agent_n8n_connections_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_agent_n8n_connections_updated_at ON public.agent_n8n_connections;
CREATE TRIGGER set_agent_n8n_connections_updated_at
    BEFORE UPDATE ON public.agent_n8n_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_n8n_connections_updated_at();

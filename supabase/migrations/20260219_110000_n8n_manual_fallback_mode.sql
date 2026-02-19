-- Enable manual fallback mode for n8n connections (no API key required)

ALTER TABLE public.agent_n8n_connections
    ALTER COLUMN api_key_encrypted DROP NOT NULL;

ALTER TABLE public.agent_n8n_connections
    ADD COLUMN IF NOT EXISTS connection_mode text NOT NULL DEFAULT 'api';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'agent_n8n_connections_connection_mode_check'
    ) THEN
        ALTER TABLE public.agent_n8n_connections
            ADD CONSTRAINT agent_n8n_connections_connection_mode_check
            CHECK (connection_mode IN ('api', 'manual'));
    END IF;
END $$;

UPDATE public.agent_n8n_connections
SET connection_mode = CASE
    WHEN api_key_encrypted IS NULL THEN 'manual'
    ELSE 'api'
END;

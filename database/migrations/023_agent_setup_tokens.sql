-- Temporary tokens for browser-based agent setup flow
-- Used by the CLI installer to bridge browser auth to terminal

CREATE TABLE IF NOT EXISTS agent_setup_tokens (
    token TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready')),
    api_key TEXT,
    agent_id UUID,
    agent_name TEXT,
    project_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-expire tokens after 10 minutes
CREATE INDEX IF NOT EXISTS idx_agent_setup_tokens_created
ON agent_setup_tokens(created_at);

-- No RLS needed — tokens are ephemeral and accessed by service role only

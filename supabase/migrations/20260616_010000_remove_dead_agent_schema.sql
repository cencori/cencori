-- Remove dead schema: agent_sessions table and session_id FK on agent_actions
-- These were never used by application code.

ALTER TABLE public.agent_actions
    DROP CONSTRAINT IF EXISTS agent_actions_session_id_fkey,
    DROP COLUMN IF EXISTS session_id;

DROP TABLE IF EXISTS public.agent_sessions;

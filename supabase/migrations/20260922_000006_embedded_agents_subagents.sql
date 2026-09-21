-- v1.1 subagent delegation: explicit version edges + isolated child runs.
-- PRD §8.3.4. Delegation narrows scope; it never escalates.
-- Service-role access only (no anon policies).

-- ── agent_version_subagents (allowed delegation edges) ──
CREATE TABLE IF NOT EXISTS public.agent_version_subagents (
    parent_agent_version_id uuid NOT NULL REFERENCES public.agent_versions(id) ON DELETE CASCADE,
    child_agent_version_id uuid NOT NULL REFERENCES public.agent_versions(id) ON DELETE RESTRICT,
    max_calls integer NOT NULL DEFAULT 1 CHECK (max_calls BETWEEN 1 AND 25),
    timeout_ms integer NULL,
    budget_limit numeric NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (parent_agent_version_id, child_agent_version_id)
);

-- ── embedded_runs delegation columns ──
ALTER TABLE public.embedded_runs
    ADD COLUMN IF NOT EXISTS parent_run_id uuid NULL REFERENCES public.embedded_runs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS delegation_depth integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_embedded_runs_parent ON public.embedded_runs(parent_run_id) WHERE parent_run_id IS NOT NULL;

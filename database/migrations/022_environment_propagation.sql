-- Propagate environment column across all request/event tables
-- so the dashboard can filter ALL data by production vs test environment

-- 1. ai_requests — the main request log table
ALTER TABLE ai_requests
ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production'
CHECK (environment IN ('production', 'test'));

CREATE INDEX IF NOT EXISTS idx_ai_requests_environment
ON ai_requests(environment);

CREATE INDEX IF NOT EXISTS idx_ai_requests_project_env_created
ON ai_requests(project_id, environment, created_at DESC);

-- 2. security_incidents — security events need env scoping
ALTER TABLE security_incidents
ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production'
CHECK (environment IN ('production', 'test'));

CREATE INDEX IF NOT EXISTS idx_security_incidents_environment
ON security_incidents(environment);

-- 3. security_audit_log — audit events need env scoping
ALTER TABLE security_audit_log
ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production'
CHECK (environment IN ('production', 'test'));

CREATE INDEX IF NOT EXISTS idx_security_audit_log_environment
ON security_audit_log(environment);

-- 4. prompt_cache_entries — cache is env-specific
ALTER TABLE prompt_cache_entries
ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production'
CHECK (environment IN ('production', 'test'));

CREATE INDEX IF NOT EXISTS idx_prompt_cache_entries_environment
ON prompt_cache_entries(environment);

-- 5. prompt_cache_events — cache analytics per env
ALTER TABLE prompt_cache_events
ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production'
CHECK (environment IN ('production', 'test'));

-- 6. prompt_usage_log — prompt usage per env
ALTER TABLE prompt_usage_log
ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production'
CHECK (environment IN ('production', 'test'));

-- 7. agent_sessions — agent activity per env
ALTER TABLE agent_sessions
ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production'
CHECK (environment IN ('production', 'test'));

-- 8. memories — RAG memories per env (keep prod/test data separate)
ALTER TABLE memories
ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production'
CHECK (environment IN ('production', 'test'));

CREATE INDEX IF NOT EXISTS idx_memories_environment
ON memories(environment);

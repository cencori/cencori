-- Remove dead schema: agent_approvals and agent_n8n_connections
-- agent_approvals was created for shadow mode approval but never wired to app code.
-- agent_n8n_connections was created for n8n control-plane integration but never used.
-- Both have zero application code references.

DROP TABLE IF EXISTS public.agent_approvals;
DROP TABLE IF EXISTS public.agent_n8n_connections;

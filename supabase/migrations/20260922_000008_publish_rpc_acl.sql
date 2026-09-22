-- Explicit role ACL for the atomic publication RPC.
-- The base migration revoked PUBLIC, but default grants vary by project: lock
-- the function to service_role explicitly. Verify in production with:
--   select grantee, privilege_type
--   from information_schema.routine_privileges
--   where routine_name = 'publish_embedded_agent_version';

REVOKE ALL ON FUNCTION public.publish_embedded_agent_version(uuid, uuid, text, boolean, uuid[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_embedded_agent_version(uuid, uuid, text, boolean, uuid[], jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.publish_embedded_agent_version(uuid, uuid, text, boolean, uuid[], jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.publish_embedded_agent_version(uuid, uuid, text, boolean, uuid[], jsonb) TO service_role;

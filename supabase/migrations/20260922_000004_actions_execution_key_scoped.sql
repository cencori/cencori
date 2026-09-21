-- Scope action idempotency keys by project (was global UNIQUE on execution_key).
-- Cross-project key reuse is a different action; global uniqueness also leaked
-- existence across projects via conflict errors.

ALTER TABLE public.actions DROP CONSTRAINT IF EXISTS actions_execution_key_key;
ALTER TABLE public.actions ADD CONSTRAINT actions_project_execution_key_unique UNIQUE (project_id, execution_key);

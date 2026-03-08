-- RLS Security Patch
-- Fixes two gaps found during database audit:
--   1. semantic_cache: no RLS enabled at all (fully exposed to anon key)
--   2. shared_chats: overly permissive "Anyone can insert" policy

-- ============================================================
-- 1. semantic_cache: Enable RLS + add scoped policies
-- ============================================================

ALTER TABLE semantic_cache ENABLE ROW LEVEL SECURITY;

-- Only the service role (server-side) should read/write cache.
-- No client-side access needed — cache is used internally by the API.
-- With RLS enabled and no policies for anon/authenticated roles,
-- only service_role (which bypasses RLS) can access this table.

-- ============================================================
-- 2. shared_chats: Drop the overly permissive anonymous INSERT
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert chats" ON shared_chats;

-- The remaining "Users can insert their own chats" policy
-- (WITH CHECK auth.uid() = user_id) is sufficient.
-- Unauthenticated sharing is not supported.

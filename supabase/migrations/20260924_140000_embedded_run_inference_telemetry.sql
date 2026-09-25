-- Background embedded runs have no API key attached to their executor. The
-- public playground and pre-auth Gateway refusals can also lack an API key,
-- so nullability must not be limited to run endpoints. Existing RLS still
-- scopes reads by project membership.
ALTER TABLE public.ai_requests
    ALTER COLUMN api_key_id DROP NOT NULL;

ALTER TABLE public.ai_requests
    DROP CONSTRAINT IF EXISTS ai_requests_key_or_run_check;

-- Production currently grants anon/authenticated INSERT and UPDATE, while
-- legacy write policies apply to PUBLIC with unrestricted checks. That lets a
-- client forge or alter usage records through PostgREST. All metering writes
-- originate in server code with the service role; keep project-scoped SELECT
-- policies intact while removing direct client write privileges.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON TABLE public.ai_requests FROM PUBLIC, anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.ai_requests TO service_role;

DROP POLICY IF EXISTS "Service role can insert ai_requests" ON public.ai_requests;
DROP POLICY IF EXISTS "Service role can update ai_requests" ON public.ai_requests;

CREATE POLICY "Service role can insert ai_requests"
    ON public.ai_requests FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update ai_requests"
    ON public.ai_requests FOR UPDATE TO service_role USING (true) WITH CHECK (true);

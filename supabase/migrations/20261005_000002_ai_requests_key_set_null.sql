-- Bachs-Docs case: rotating/deleting a Cencori API key hard-deleted its
-- ai_requests history via ON DELETE CASCADE, making logs look "gone".
-- Key rows are credentials, not log owners — keep history with SET NULL so
-- revoked-key and rotated-key rows stay visible (api_key_name falls back to
-- 'Unknown' / 'No key' in the logs API).
--
-- project_id stays ON DELETE CASCADE: deleting a project deletes its logs.

-- Drop any existing FK on ai_requests.api_key_id (auto-generated names vary
-- between inline REFERENCES and named constraints), then re-add SET NULL.
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'public.ai_requests'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%api_key_id%REFERENCES%api_keys%'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.ai_requests DROP CONSTRAINT %I', fk_name);
    END IF;
END $$;

-- Ensure nullable (20260924 already dropped NOT NULL, keep idempotent).
ALTER TABLE public.ai_requests
    ALTER COLUMN api_key_id DROP NOT NULL;

-- Re-add only if missing (idempotent reruns).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.ai_requests'::regclass
          AND conname = 'ai_requests_api_key_id_fkey'
    ) THEN
        ALTER TABLE public.ai_requests
            ADD CONSTRAINT ai_requests_api_key_id_fkey
            FOREIGN KEY (api_key_id)
            REFERENCES public.api_keys(id)
            ON DELETE SET NULL;
    END IF;
END $$;

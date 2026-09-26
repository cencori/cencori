-- Unify BYOK key stores: provider_keys (dashboard) <-> provider_connections (embedded API).
--
-- Both tables held the same official-vendor keys with no sync between them, so
-- an API-added key returned 201 yet never powered agents and never appeared on
-- the dashboard. Runtime code now mirrors writes in both directions; this
-- migration heals rows created before that shipped. Idempotent and
-- non-destructive: it never overwrites an existing dashboard key and never
-- deletes anything.
--
-- Mirrorable vendors are limited to the provider_keys CHECK list (minus the
-- dashboard-only legacy 'openrouter'): proxy/custom rows stay embedded-only.

-- 1) Dashboard keys -> embedded connections (newest active managed row wins;
--    rows that already have a keyed managed connection are skipped).
INSERT INTO public.provider_connections
    (project_id, name, provider, api_format, base_url, encrypted_key_ref, key_hint, status, created_at)
SELECT
    k.project_id,
    k.provider,
    k.provider,
    CASE WHEN k.provider = 'anthropic' THEN 'anthropic' ELSE 'openai' END,
    NULL,
    k.encrypted_key,
    k.key_hint,
    CASE WHEN k.is_active THEN 'active' ELSE 'disabled' END,
    k.created_at
FROM public.provider_keys k
WHERE k.provider IN (
    'openai', 'anthropic', 'google', 'mistral', 'groq', 'cohere',
    'together', 'perplexity', 'xai', 'meta', 'huggingface', 'qwen', 'deepseek'
)
AND NOT EXISTS (
    SELECT 1 FROM public.provider_connections c
    WHERE c.project_id = k.project_id
      AND c.provider = k.provider
      AND c.base_url IS NULL
      AND c.encrypted_key_ref IS NOT NULL
);

-- 2) Embedded keys -> dashboard keys (newest active managed connection per
--    project+provider; never clobbers an existing dashboard key).
INSERT INTO public.provider_keys (project_id, provider, encrypted_key, key_hint, is_active, updated_at)
SELECT DISTINCT ON (c.project_id, c.provider)
    c.project_id,
    c.provider,
    c.encrypted_key_ref,
    c.key_hint,
    true,
    now()
FROM public.provider_connections c
WHERE c.base_url IS NULL
  AND c.status = 'active'
  AND c.encrypted_key_ref IS NOT NULL
  AND c.provider IN (
      'openai', 'anthropic', 'google', 'mistral', 'groq', 'cohere',
      'together', 'perplexity', 'xai', 'meta', 'huggingface', 'qwen', 'deepseek'
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.provider_keys k
      WHERE k.project_id = c.project_id
        AND k.provider = c.provider
  )
ORDER BY c.project_id, c.provider, c.created_at DESC
ON CONFLICT DO NOTHING;

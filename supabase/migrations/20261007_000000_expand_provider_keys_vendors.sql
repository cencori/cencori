-- Expand provider_keys vendor CHECK to match SUPPORTED_PROVIDERS.
--
-- The dashboard lists every entry in lib/providers/config.ts SUPPORTED_PROVIDERS
-- (23 vendors as of 2026-10-07), but the provider_keys CHECK still only allowed
-- the 14 vendors from the original 009_provider_keys migration. Saving a key for
-- any newer vendor (maximo, cerebras, helix, bai, centaur, zai, deepgram,
-- cartesia, spitch, assemblyai, elevenlabs) failed with:
--   new row for relation "provider_keys" violates check constraint
--   "provider_keys_provider_check"
--
-- This keeps the two legacy values (openrouter, huggingface) so existing rows
-- keep validating, and adds every current SUPPORTED_PROVIDERS id.

ALTER TABLE public.provider_keys
    DROP CONSTRAINT IF EXISTS provider_keys_provider_check;

ALTER TABLE public.provider_keys
    ADD CONSTRAINT provider_keys_provider_check CHECK (provider IN (
        'openai', 'anthropic', 'google', 'mistral', 'groq',
        'cohere', 'together', 'perplexity', 'openrouter', 'xai',
        'meta', 'huggingface', 'qwen', 'deepseek',
        'zai', 'cerebras', 'maximo', 'helix', 'bai', 'centaur',
        'deepgram', 'cartesia', 'spitch', 'assemblyai', 'elevenlabs'
    ));

-- Judgment API (Cloudflare Clef) catalog.
--
-- Companion to the lib/providers/config.ts `cloudflare` entries and
-- lib/judgment/clef.ts in the same commit. Without an active model_pricing
-- row, getPricingFromDB fails closed and every judgment through Clef returns
-- 503 `pricing_unavailable`.
--
-- Clef is Cloudflare's decision-model family on Workers AI, the same family
-- as TypeSafe's Jev — one body contract (state + typed noul/choice/score
-- questions), input-token billing only, no generated text ever returned.
-- Verified 2026-10-18 against the Workers AI pricing page and the Clef /
-- Clef-flash / Clef-omni model pages:
--   @cf/cloudflare/clef        flagship 27B, $0.24 per 1M input tokens, 64k context
--   @cf/cloudflare/clef-flash  fast 9B,       $0.038 per 1M input tokens, 24k context
--   @cf/cloudflare/clef-omni   omni 64k,      $0.15 per 1M input tokens,   64k context
-- All bill input tokens only; they convert media inputs to input tokens and
-- leave output tokens free, so the output column is 0. Clef-omni additionally
-- reads WAV/MP3 audio and MP4/WebM video; audio/video states are a Clef-omni
-- extension, and the Cencori judgment contract is text/JSON for all three.
-- Sources: https://developers.cloudflare.com/workers-ai/platform/pricing/
--          https://developers.cloudflare.com/ai/models/%40cf/cloudflare/clef/
--
-- Also expands the provider_keys vendor CHECK so projects can save a
-- `cloudflare` BYOK key, stored as `<ACCOUNT_ID>:<API_TOKEN>` since a Workers
-- AI REST call needs both the account id (URL) and the token (Authorization)
-- — same pattern as 20261015_130000_typesafe_judgment_catalog.sql.
--
-- Markup is 0.00 on all rows, matching the post-20260924 no-markup schedule.

ALTER TABLE public.provider_keys
    DROP CONSTRAINT IF EXISTS provider_keys_provider_check;

ALTER TABLE public.provider_keys
    ADD CONSTRAINT provider_keys_provider_check CHECK (provider IN (
        'openai', 'anthropic', 'google', 'mistral', 'groq',
        'cohere', 'together', 'perplexity', 'openrouter', 'xai',
        'meta', 'huggingface', 'qwen', 'deepseek',
        'zai', 'cerebras', 'maximo', 'helix', 'bai', 'centaur',
        'typesafe', 'cloudflare',
        'deepgram', 'cartesia', 'spitch', 'assemblyai', 'elevenlabs'
    ));

INSERT INTO public.model_pricing (
    provider,
    model_name,
    input_price_per_1k_tokens,
    output_price_per_1k_tokens,
    cached_input_price_per_1k_tokens,
    long_context_threshold_tokens,
    long_context_input_price_per_1k_tokens,
    long_context_output_price_per_1k_tokens,
    long_context_cached_input_price_per_1k_tokens,
    cencori_markup_percentage,
    is_active,
    pricing_source_url,
    pricing_reviewed_at,
    review_notes
) VALUES
    ('cloudflare', 'clef-latest',
     0.00024000, 0.00000000, NULL,
     NULL, NULL, NULL, NULL,
     0.00, true,
     'https://developers.cloudflare.com/workers-ai/platform/pricing/', '2026-10-18T00:00:00Z',
     'Clef flagship 27B decision model via the Judgment API (upstream @cf/cloudflare/clef). Input-only billing $0.24/MTok; output free; 64k context; media inputs tokenize to input tokens.'),

    ('cloudflare', 'clef-omni',
     0.00015000, 0.00000000, NULL,
     NULL, NULL, NULL, NULL,
     0.00, true,
     'https://developers.cloudflare.com/workers-ai/platform/pricing/', '2026-10-18T00:00:00Z',
     'Clef Omni decision model via the Judgment API (upstream @cf/cloudflare/clef-omni). Input-only billing $0.15/MTok; output free; 64k context, and the tier that adds WAV/MP3 audio and MP4/WebM video states upstream.'),

    ('cloudflare', 'clef-flash',
     0.00003800, 0.00000000, NULL,
     NULL, NULL, NULL, NULL,
     0.00, true,
     'https://developers.cloudflare.com/workers-ai/platform/pricing/', '2026-10-18T00:00:00Z',
     'Clef Flash 9B decision model via the Judgment API (upstream @cf/cloudflare/clef-flash). Input-only billing $0.038/MTok; output free; hosted context 24k (dropped from 64k with the Oct 2026 price cut); media inputs tokenize to input tokens.')
ON CONFLICT (provider, model_name) DO UPDATE SET
    input_price_per_1k_tokens = EXCLUDED.input_price_per_1k_tokens,
    output_price_per_1k_tokens = EXCLUDED.output_price_per_1k_tokens,
    cached_input_price_per_1k_tokens = EXCLUDED.cached_input_price_per_1k_tokens,
    long_context_threshold_tokens = EXCLUDED.long_context_threshold_tokens,
    long_context_input_price_per_1k_tokens = EXCLUDED.long_context_input_price_per_1k_tokens,
    long_context_output_price_per_1k_tokens = EXCLUDED.long_context_output_price_per_1k_tokens,
    long_context_cached_input_price_per_1k_tokens = EXCLUDED.long_context_cached_input_price_per_1k_tokens,
    cencori_markup_percentage = EXCLUDED.cencori_markup_percentage,
    is_active = EXCLUDED.is_active,
    pricing_source_url = EXCLUDED.pricing_source_url,
    pricing_reviewed_at = EXCLUDED.pricing_reviewed_at,
    review_notes = EXCLUDED.review_notes,
    updated_at = now();

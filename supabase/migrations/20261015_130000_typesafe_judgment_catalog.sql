-- Judgment API (TypeSafe Jev) catalog.
--
-- Companion to the lib/providers/config.ts `typesafe` entries and
-- app/api/v1/judgments/route.ts in the same commit. Without an active
-- model_pricing row, getPricingFromDB fails closed and every judgment returns
-- 503 `pricing_unavailable`.
--
-- Jev 1.13 (jev-latest / jev-preview aliases resolve to jev-1.13.0 upstream):
-- TypeSafe bills input tokens only at $42 per Btok = $0.042 per MTok; output
-- tokens are free, so the output column is 0. 64k tokens per request (32k for
-- state plus the longest question). Verified live 2026-10-15 via
-- GET https://api.typesafe.ai/v1/models (aliases dated 2026-09-10).
-- Source: https://docs.typesafe.ai/models
--
-- Also expands the provider_keys vendor CHECK so projects can save a
-- `typesafe` BYOK key (same pattern as 20261007_000000_expand_provider_keys_vendors.sql).
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
        'typesafe',
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
    ('typesafe', 'jev-latest',
     0.00004200, 0.00000000, NULL,
     NULL, NULL, NULL, NULL,
     0.00, true,
     'https://docs.typesafe.ai/models', '2026-10-15T00:00:00Z',
     'Jev flagship alias via the Judgment API (resolves to jev-1.13.0). Input-only billing $0.042/MTok; output free. 64k per request.'),

    ('typesafe', 'jev-preview',
     0.00004200, 0.00000000, NULL,
     NULL, NULL, NULL, NULL,
     0.00, true,
     'https://docs.typesafe.ai/models', '2026-10-15T00:00:00Z',
     'Jev preview alias via the Judgment API. Input-only billing $0.042/MTok; output free. 64k per request.'),

    ('typesafe', 'jev-1.13.0',
     0.00004200, 0.00000000, NULL,
     NULL, NULL, NULL, NULL,
     0.00, true,
     'https://docs.typesafe.ai/models', '2026-10-15T00:00:00Z',
     'Pinned Jev 1.13 release via the Judgment API. Input-only billing $0.042/MTok; output free. 64k per request.')
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

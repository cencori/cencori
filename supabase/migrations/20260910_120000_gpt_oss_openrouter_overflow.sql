-- Give GPT OSS a second route so it stops rate-limiting.
--
-- Problem: openai/gpt-oss-120b and openai/gpt-oss-20b have exactly one route —
-- Groq — and Cencori's Groq account is on the free developer plan, which caps at
-- 1,000 requests/day and 8,000 tokens/minute ACROSS ALL CUSTOMERS. 8k TPM is
-- roughly two or three concurrent conversations. A paying customer on this model
-- hits 429s under entirely normal use.
--
-- Failover did not help, and made it worse. FALLBACK_CHAINS sent groq to
-- ['openai', 'anthropic', 'google', 'mistral'] — none of which has a funded key —
-- and with no model mapping for gpt-oss, getFallbackModel fell through to its
-- default of gpt-5.4-mini. So a 429 on a cheap open-weight model tried to answer
-- with a frontier model on an unfunded account, four times, then surfaced
-- "All providers exhausted".
--
-- Fix: OpenRouter serves the identical model. These rows make that route
-- priceable (getPricingFromDB fails closed, so an unpriced fallback 503s instead
-- of answering) and the model_mappings rows point gpt-oss at itself on
-- OpenRouter rather than at a frontier substitute. lib/providers/failover.ts is
-- changed alongside this to put openrouter first in Groq's chain.
--
-- Rates read live from https://openrouter.ai/api/v1/models on 2026-09-10 and
-- multiplied by 1000 for this table's per-1k-token unit:
--   openai/gpt-oss-120b  $0.037 / $0.170 per 1M
--   openai/gpt-oss-20b   $0.030 / $0.130 per 1M
--
-- Note these land BELOW the existing groq rows ($0.15/$0.60 and $0.075/$0.30,
-- which track Groq's published paid rate). Overflow traffic is therefore cheaper
-- for the customer than the primary route, not more expensive — the safe
-- direction for a fallback the customer did not choose.
--
-- REQUIRES CREDIT: OpenRouter's paid tier is pay-as-you-go and needs a positive
-- balance. The account is currently is_free_tier with usage 0, so these rows do
-- nothing until credit is added. $10 buys roughly 142M tokens of gpt-oss-120b at
-- a 3:1 input:output mix, and separately lifts the :free daily cap from 50 to
-- 1,000 requests.

INSERT INTO public.model_pricing (
    provider, model_name,
    input_price_per_1k_tokens, output_price_per_1k_tokens,
    cached_input_price_per_1k_tokens,
    long_context_threshold_tokens,
    long_context_input_price_per_1k_tokens,
    long_context_output_price_per_1k_tokens,
    long_context_cached_input_price_per_1k_tokens,
    cencori_markup_percentage, is_active,
    pricing_source_url, pricing_reviewed_at, review_notes
) VALUES
    ('openrouter', 'openai/gpt-oss-120b', 0.00003700, 0.00017000, NULL, NULL, NULL, NULL, NULL, 50.00, true,
     'https://openrouter.ai/api/v1/models', '2026-09-10T00:00:00Z',
     'Overflow route for groq:openai/gpt-oss-120b, which runs on Groq''s free plan (1k req/day, 8k TPM shared).'),
    ('openrouter', 'openai/gpt-oss-20b', 0.00003000, 0.00013000, NULL, NULL, NULL, NULL, NULL, 50.00, true,
     'https://openrouter.ai/api/v1/models', '2026-09-10T00:00:00Z',
     'Overflow route for groq:openai/gpt-oss-20b, which runs on Groq''s free plan (1k req/day, 8k TPM shared).')
ON CONFLICT (provider, model_name) DO UPDATE SET
    input_price_per_1k_tokens = EXCLUDED.input_price_per_1k_tokens,
    output_price_per_1k_tokens = EXCLUDED.output_price_per_1k_tokens,
    cencori_markup_percentage = EXCLUDED.cencori_markup_percentage,
    is_active = EXCLUDED.is_active,
    pricing_source_url = EXCLUDED.pricing_source_url,
    pricing_reviewed_at = EXCLUDED.pricing_reviewed_at,
    review_notes = EXCLUDED.review_notes;

-- Route the model to ITSELF on the fallback provider. Every other row in
-- model_mappings substitutes a different model from a different vendor, which is
-- right for a frontier model that has no twin elsewhere. gpt-oss does have a
-- twin — the same open weights, served by someone else — so the customer should
-- get the model they asked for, not an approximation of it.
INSERT INTO public.model_mappings (source_model, target_provider, target_model) VALUES
    ('openai/gpt-oss-120b', 'openrouter', 'openai/gpt-oss-120b'),
    ('openai/gpt-oss-20b', 'openrouter', 'openai/gpt-oss-20b')
ON CONFLICT (source_model, target_provider) DO UPDATE SET
    target_model = EXCLUDED.target_model;

-- October 2026 generation: Claude Sonnet 5.5, Claude Haiku 5.5, Mistral Large 4.
--
-- Companion to the lib/providers/config.ts entries in the same commit. Without
-- an active model_pricing row, getPricingFromDB fails closed and every request
-- for the model returns 503 `pricing_unavailable`.
--
-- Anthropic Claude Sonnet 5.5 (released 2026-09-28): $2/$10 per MTok, same
-- base as Sonnet 5. Cache reads were halved to $0.10/MTok on 2026-10-07
-- (alongside the Haiku 5.5 launch), so the cached rate stored here is
-- 0.05x — not the usual 0.1x, and not the $0.20 the launch-day rate card
-- showed. 1M context at standard pricing, so no long-context tier.
-- Sources: https://platform.claude.com/docs/en/about-claude/pricing and
-- https://platform.claude.com/docs/en/models/sonnet-5-5/overview.
--
-- Anthropic Claude Haiku 5.5 (released 2026-10-07): the first Claude priced by
-- prompt length. At or under 100,000 prompt tokens it is $0.10/$0.50 per MTok
-- (cache read $0.01); above 100,000 every rate is 5x ($0.50/$2.50, cache read
-- $0.05). That maps onto the long_context_* columns with a 100000 threshold:
-- calculateProviderTokenCost tiers on total prompt tokens (cached tokens
-- occupy context too), which matches Anthropic's "prompt of over 100,000
-- tokens pays higher prices". 1M context (up from 200k on Haiku 4.5).
-- Sources: https://platform.claude.com/docs/en/about-claude/pricing and
-- https://platform.claude.com/docs/en/models/haiku-5-5/overview.
--
-- Mistral Large 4 "Le Chonk" (public preview 2026-10-06, v26.10): 1T-param
-- granular MoE (52B active + 1.6B vision encoder). Preview sale pricing with
-- NO published end date — $0.68/$2.09 per MTok, cached input $0.07 — against
-- an original rate of $1.36/$4.18 (cached $0.14). The sale rate is stored as
-- the current price with no pricing_expires_at (there is no date to schedule
-- a changeover to); the original rate is recorded here so the row can be
-- revisited at GA. Re-check whether the sale is still live before treating
-- this as permanent. Sources: https://docs.mistral.ai/inference/pricing and
-- https://docs.mistral.ai/models/mistral-large-4-0.
-- The versioned `mistral-large-4-0` id is what Mistral's docs and native
-- examples send; bare `mistral-large-4` is aliased to it in
-- lib/providers/router.ts, and pricing is keyed on the versioned id.
--
-- Markup is 0.00 on all three rows, matching the post-20260924 no-markup
-- schedule (gateway bills the provider rate directly).

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
    ('anthropic', 'claude-sonnet-5-5',
     0.00200000, 0.01000000, 0.00010000,
     NULL, NULL, NULL, NULL,
     0.00, true,
     'https://platform.claude.com/docs/en/about-claude/pricing', '2026-10-08T00:00:00Z',
     'Sonnet 5.5 base $2/$10 per MTok (same as Sonnet 5). Cache read $0.10/MTok (0.05x) since the 2026-10-07 halving. No long-context tier: full 1M at standard pricing.'),

    ('anthropic', 'claude-haiku-5-5',
     0.00010000, 0.00050000, 0.00001000,
     100000, 0.00050000, 0.00250000, 0.00005000,
     0.00, true,
     'https://platform.claude.com/docs/en/about-claude/pricing', '2026-10-08T00:00:00Z',
     'Haiku 5.5 tiered by prompt length: $0.10/$0.50 per MTok (cache $0.01) at or under 100k prompt tokens, 5x above ($0.50/$2.50, cache $0.05). 1M context.'),

    ('mistral', 'mistral-large-4-0',
     0.00068000, 0.00209000, 0.00007000,
     NULL, NULL, NULL, NULL,
     0.00, true,
     'https://docs.mistral.ai/inference/pricing', '2026-10-08T00:00:00Z',
     'Large 4 preview sale $0.68/$2.09 per MTok (cached $0.07); original rate $1.36/$4.18 (cached $0.14) with no published sale end date — revisit at GA. No long-context tier published.')
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

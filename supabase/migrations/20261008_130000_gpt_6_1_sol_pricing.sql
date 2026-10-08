-- OpenAI GPT-6.1 Sol (released 2026-09-29 at DevDay).
--
-- Companion to the lib/providers/config.ts entry in the same commit. Without
-- an active model_pricing row, getPricingFromDB fails closed and every request
-- for the model returns 503 `pricing_unavailable`.
--
-- Mid-tier refresh of GPT-6 Sol: near-Astra coding/computer-use at one-fifth
-- of Astra's prices. Same $2/$10 per MTok base as 6 Sol, but cache reads are
-- halved to $0.10/MTok (0.05x, not the usual 0.1x). 1.05M context, 128k max
-- output. Sources: https://developers.openai.com/api/docs/models/gpt-6.1-sol
-- and https://developers.openai.com/api/docs/pricing.
--
-- Long-context surcharge past 272,000 input tokens (2x input and cache rates,
-- 1.5x output — $4.00/$0.20/$15.00 — applied to the FULL request once the
-- threshold is crossed) maps onto the long_context_* columns with a 272000
-- threshold, the same shape as the xAI tiered rows. Note the older GPT-6 rows
-- (astra/sol/luna, 20260923 migration) carry no long-context tier even though
-- OpenAI documents the same 272k policy for them — long prompts on those ids
-- bill at standard rates until their rows are backfilled.
--
-- Cache writes ($2.50/MTok, 1.25x) are not stored: no adapter tracks OpenAI
-- cache writes, so every OpenAI row prices writes at the input rate — same
-- treatment as the rest of the table.
--
-- One secondary report describes this as promotional pricing "available at
-- least through November 21, 2026", but with no published successor rate there
-- is nothing to schedule a changeover to: storing pricing_expires_at without
-- next_* rates would fail closed (503) on that date, so no expiry is set.
-- Revisit the rate card after that date instead.
--
-- Markup is 0.00, matching the post-20260924 no-markup schedule.

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
    ('openai', 'gpt-6.1-sol',
     0.00200000, 0.01000000, 0.00010000,
     272000, 0.00400000, 0.01500000, 0.00020000,
     0.00, true,
     'https://developers.openai.com/api/docs/pricing', '2026-10-08T00:00:00Z',
     'GPT-6.1 Sol $2/$10 per MTok, cache read $0.10/MTok (0.05x). Past 272k input tokens: 2x in/cache, 1.5x out on the full request. Possible promo end 2026-11-21 (unconfirmed) — revisit then.')
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

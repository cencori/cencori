-- Backfill the GPT-6 long-context tiers (Astra / Sol / Luna).
--
-- The 20260923 flagship migration priced these at their short-context rates
-- only, but OpenAI bills 2x input and cache rates and 1.5x output for the
-- FULL request once the prompt passes 272,000 input tokens — the same policy
-- GPT-6.1 Sol shipped with (20261008_130000). Without these columns a
-- 500k-prompt Astra call bills at roughly half its real cost.
--
-- Rates re-checked 2026-10-08 against the per-model pages and the pricing
-- table (https://developers.openai.com/api/docs/pricing); the short-context
-- base rates are re-asserted unchanged below. Stored per-1K:
--
--   model        short in/out/cached      long in/out/cached (>272k)
--   gpt-6-astra  $10/$50/$1.00            $20/$75/$2.00
--   gpt-6-sol    $2/$10/$0.20             $4/$15/$0.40
--   gpt-6-luna   $0.10/$0.50/$0.01        $0.20/$0.75/$0.02
--
-- UPDATE (not INSERT ... ON CONFLICT): the base rates were already reviewed,
-- so only the tier columns, provenance and notes move here.

UPDATE public.model_pricing
SET long_context_threshold_tokens = 272000,
    long_context_input_price_per_1k_tokens = 0.02000000,
    long_context_output_price_per_1k_tokens = 0.07500000,
    long_context_cached_input_price_per_1k_tokens = 0.00200000,
    pricing_source_url = 'https://developers.openai.com/api/docs/pricing',
    pricing_reviewed_at = '2026-10-08T00:00:00Z',
    review_notes = 'New generation flagship, $10/$50 per MTok, cache read $1/MTok. Past 272k input tokens: 2x in/cache, 1.5x out on the full request ($20/$75, cache $2).',
    updated_at = now()
WHERE provider = 'openai' AND model_name = 'gpt-6-astra';

UPDATE public.model_pricing
SET long_context_threshold_tokens = 272000,
    long_context_input_price_per_1k_tokens = 0.00400000,
    long_context_output_price_per_1k_tokens = 0.01500000,
    long_context_cached_input_price_per_1k_tokens = 0.00040000,
    pricing_source_url = 'https://developers.openai.com/api/docs/pricing',
    pricing_reviewed_at = '2026-10-08T00:00:00Z',
    review_notes = 'GPT-6 flagship tier, $2/$10 per MTok, cache read $0.20/MTok. Past 272k input tokens: 2x in/cache, 1.5x out on the full request ($4/$15, cache $0.40).',
    updated_at = now()
WHERE provider = 'openai' AND model_name = 'gpt-6-sol';

UPDATE public.model_pricing
SET long_context_threshold_tokens = 272000,
    long_context_input_price_per_1k_tokens = 0.00020000,
    long_context_output_price_per_1k_tokens = 0.00075000,
    long_context_cached_input_price_per_1k_tokens = 0.00002000,
    pricing_source_url = 'https://developers.openai.com/api/docs/pricing',
    pricing_reviewed_at = '2026-10-08T00:00:00Z',
    review_notes = 'Cheapest frontier tier, $0.10/$0.50 per MTok, cache read $0.01/MTok. Past 272k input tokens: 2x in/cache, 1.5x out on the full request ($0.20/$0.75, cache $0.02).',
    updated_at = now()
WHERE provider = 'openai' AND model_name = 'gpt-6-luna';

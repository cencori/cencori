-- Price Maximo Atlas 1.3.
--
-- A full-stack frontier agent for terminal, code, and web work at max
-- reasoning effort, now live on the Maximo AI API Platform at $0.20 input /
-- $0.02 cached input / $0.50 output per 1M tokens (rate confirmed by Maximo
-- directly, 2026-09-23). Verified servable the same day: a live chat call
-- answered 200. Stored per-1K with the standard 50% markup.
--
-- Flat rate, no promo window and no long-context tier published — so no
-- `pricing_expires_at`, no `next_*` successor and NULL long-context columns.
-- Cache writes bill at the normal input rate (1.0x default, no
-- CACHE_WRITE_MULTIPLIERS entry), same as Atlas 1.2.

INSERT INTO public.model_pricing (
    provider,
    model_name,
    input_price_per_1k_tokens,
    output_price_per_1k_tokens,
    cencori_markup_percentage,
    is_active,
    pricing_source_url,
    pricing_reviewed_at,
    pricing_expires_at,
    cached_input_price_per_1k_tokens,
    long_context_threshold_tokens,
    long_context_input_price_per_1k_tokens,
    long_context_output_price_per_1k_tokens,
    long_context_cached_input_price_per_1k_tokens,
    next_input_price_per_1k_tokens,
    next_output_price_per_1k_tokens,
    next_cached_input_price_per_1k_tokens,
    review_notes
) VALUES
    ('maximo', 'maximo-atlas-1.3',
     0.00020000, 0.00050000, 50.00, true,
     'https://maximoai.co/platform', '2026-09-23T00:00:00Z', NULL,
     0.00002000,
     NULL, NULL, NULL, NULL,
     NULL, NULL, NULL,
     'Launch rate $0.20/$0.02 cached/$0.50 per MTok, confirmed by Maximo 2026-09-23 and verified servable live. No promo window or long-context tier published.')
ON CONFLICT (provider, model_name) DO UPDATE SET
    input_price_per_1k_tokens = EXCLUDED.input_price_per_1k_tokens,
    output_price_per_1k_tokens = EXCLUDED.output_price_per_1k_tokens,
    cencori_markup_percentage = EXCLUDED.cencori_markup_percentage,
    is_active = EXCLUDED.is_active,
    pricing_source_url = EXCLUDED.pricing_source_url,
    pricing_reviewed_at = EXCLUDED.pricing_reviewed_at,
    pricing_expires_at = EXCLUDED.pricing_expires_at,
    cached_input_price_per_1k_tokens = EXCLUDED.cached_input_price_per_1k_tokens,
    long_context_threshold_tokens = EXCLUDED.long_context_threshold_tokens,
    long_context_input_price_per_1k_tokens = EXCLUDED.long_context_input_price_per_1k_tokens,
    long_context_output_price_per_1k_tokens = EXCLUDED.long_context_output_price_per_1k_tokens,
    long_context_cached_input_price_per_1k_tokens = EXCLUDED.long_context_cached_input_price_per_1k_tokens,
    next_input_price_per_1k_tokens = EXCLUDED.next_input_price_per_1k_tokens,
    next_output_price_per_1k_tokens = EXCLUDED.next_output_price_per_1k_tokens,
    next_cached_input_price_per_1k_tokens = EXCLUDED.next_cached_input_price_per_1k_tokens,
    review_notes = EXCLUDED.review_notes,
    effective_date = now(),
    updated_at = now();

-- Price Maximo Atlas 1.4 and 1.5.
--
-- Maximo is retiring Atlas 1.2 (its API now rejects it as retired and points to
-- 1.4). Rates as published in Maximo's own /v1/models listing, 2026-10-25:
-- $0.20 input / $0.03 cached input / $1.00 output per 1M tokens, the same for
-- both. Atlas 1.5 lists text + image input, so it replaces 1.2 as the cheap
-- vision model (Copilot uses it to read attached images). Stored per-1K with the
-- standard 50% markup, like Atlas 1.3.
--
-- Flat rate, no promo window and no long-context tier published — so no
-- `pricing_expires_at`, no `next_*` successor and NULL long-context columns.

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
    ('maximo', 'maximo-atlas-1.4',
     0.00020000, 0.00100000, 50.00, true,
     'https://maximoai.co/platform', '2026-10-25T00:00:00Z', NULL,
     0.00003000,
     NULL, NULL, NULL, NULL,
     NULL, NULL, NULL,
     '$0.20/$0.03 cached/$1.00 per MTok per Maximo /v1/models, 2026-10-25.'),
    ('maximo', 'maximo-atlas-1.5',
     0.00020000, 0.00100000, 50.00, true,
     'https://maximoai.co/platform', '2026-10-25T00:00:00Z', NULL,
     0.00003000,
     NULL, NULL, NULL, NULL,
     NULL, NULL, NULL,
     '$0.20/$0.03 cached/$1.00 per MTok per Maximo /v1/models, 2026-10-25. Text + image input.')
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

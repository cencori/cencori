-- xAI Grok 4.7 (released 2026-09-21).
--
-- Frontier xAI reasoning model for coding, agentic tasks and knowledge work,
-- succeeding Grok 4.6 at the same rate: $2/$6 per MTok with $0.50 cache reads,
-- 500k context, text + image input. Sources:
-- https://docs.x.ai/developers/models (rate card) and the 4.7 launch coverage.
-- Standard 50% markup like the other xAI rows.
--
-- No long-context tier stored: xAI bills a higher rate past 200k prompt tokens
-- on older Groks, but no 4.7 long-context figure is published yet. Storing a
-- threshold without complete successor rates would fail closed on long prompts,
-- so long-context columns stay NULL and long prompts bill standard until the
-- figure lands. NOTE: the xAI team key currently has no credits, so this row
-- prices a model nobody can call until it is funded.
--
-- Sibling rows (4.6/4.5/4.3) gain nothing here; their cached rates were already
-- stored by 20260812_120000_xai_catalog_update.sql.

INSERT INTO public.model_pricing (
    provider,
    model_name,
    input_price_per_1k_tokens,
    output_price_per_1k_tokens,
    cached_input_price_per_1k_tokens,
    cencori_markup_percentage,
    is_active,
    pricing_source_url,
    pricing_reviewed_at,
    review_notes
) VALUES
    ('xai', 'grok-4.7', 0.00200000, 0.00600000, 0.00050000, 50.00, true,
     'https://docs.x.ai/developers/models', '2026-09-23T00:00:00Z',
     'Frontier xAI reasoning model, $2/$6 per MTok, cache read $0.50/MTok, 500k context. No long-context tier until xAI publishes one.')
ON CONFLICT (provider, model_name) DO UPDATE SET
    input_price_per_1k_tokens = EXCLUDED.input_price_per_1k_tokens,
    output_price_per_1k_tokens = EXCLUDED.output_price_per_1k_tokens,
    cached_input_price_per_1k_tokens = EXCLUDED.cached_input_price_per_1k_tokens,
    cencori_markup_percentage = EXCLUDED.cencori_markup_percentage,
    is_active = EXCLUDED.is_active,
    pricing_source_url = EXCLUDED.pricing_source_url,
    pricing_reviewed_at = EXCLUDED.pricing_reviewed_at,
    review_notes = EXCLUDED.review_notes,
    updated_at = now();

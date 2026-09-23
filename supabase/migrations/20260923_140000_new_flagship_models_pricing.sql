-- New flagship models, September 2026 generation.
--
-- OpenAI GPT-6 (Astra / Sol / Luna): announced with published rates at
-- https://developers.openai.com/api/docs/pricing. The ids resolve upstream
-- (verified 2026-09-23: unknown ids 404 `model_not_found`, these answer 429
-- `credit_balance_exhausted`) but are not yet in the account's /v1/models
-- list — servable, unlisted. Standard 50% markup, cached input where published.
--
-- OpenAI GPT-5.5 Pro: highest-quality GPT-5.5 at $30/$180 per MTok, no cached
-- rate published (NULL bills cache hits at the full input rate, the safe
-- direction). Same source and markup.
--
-- Anthropic Claude Opus 5.5: Anthropic's recommended default for most
-- workloads, $4/$20 per MTok with 5% cache reads ($0.20/MTok), 1M context.
-- Source: https://platform.claude.com/docs/en/about-claude/pricing.
-- Standard 50% markup like every other Anthropic row.
--
-- NOTE: all three upstream accounts (OpenAI, Anthropic) are currently out of
-- credits, so these rows price models nobody can call until the accounts are
-- funded. That is the correct state — an unpriced row would 503 instead.

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
    ('openai', 'gpt-6-astra', 0.01000000, 0.05000000, 0.00100000, 50.00, true,
     'https://developers.openai.com/api/docs/pricing', '2026-09-23T00:00:00Z',
     'New generation flagship, $10/$50 per MTok, cache read $1/MTok.'),

    ('openai', 'gpt-6-sol', 0.00200000, 0.01000000, 0.00020000, 50.00, true,
     'https://developers.openai.com/api/docs/pricing', '2026-09-23T00:00:00Z',
     'GPT-6 flagship tier, $2/$10 per MTok, cache read $0.20/MTok.'),

    ('openai', 'gpt-6-luna', 0.00010000, 0.00050000, 0.00001000, 50.00, true,
     'https://developers.openai.com/api/docs/pricing', '2026-09-23T00:00:00Z',
     'Cheapest frontier tier, $0.10/$0.50 per MTok, cache read $0.01/MTok.'),

    ('openai', 'gpt-5.5-pro', 0.03000000, 0.18000000, NULL, 50.00, true,
     'https://developers.openai.com/api/docs/pricing', '2026-09-23T00:00:00Z',
     'Highest-quality GPT-5.5, $30/$180 per MTok. No cached rate published — cache hits bill at full input rate.'),

    ('anthropic', 'claude-opus-5-5', 0.00400000, 0.02000000, 0.00020000, 50.00, true,
     'https://platform.claude.com/docs/en/about-claude/pricing', '2026-09-23T00:00:00Z',
     'Recommended default for most workloads, $4/$20 per MTok, cache read 5% ($0.20/MTok).')
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

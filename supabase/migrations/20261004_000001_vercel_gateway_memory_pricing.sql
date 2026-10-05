-- Price the Vercel AI Gateway leg of the memory fan-out.
--
-- Memory calls GPT-OSS through Vercel's gateway (chain id
-- `vercel/openai/gpt-oss-20b`, upstream catalog id `openai/gpt-oss-20b`)
-- as the middle leg: Cerebras paid primary, Vercel paid zero-markup
-- overflow, Groq free fallback. Rates are Vercel's published list rates
-- (https://vercel.com/ai-gateway/models), which carry no platform markup —
-- unlike the retired OpenRouter proxy, there is no margin stacking here.
-- Markup stays 0.00 to match the post-20260924 no-markup schedule.
INSERT INTO public.model_pricing (
    provider,
    model_name,
    input_price_per_1k_tokens,
    output_price_per_1k_tokens,
    cencori_markup_percentage,
    is_active,
    pricing_source_url,
    pricing_reviewed_at,
    review_notes
) VALUES
    ('vercel', 'openai/gpt-oss-20b',
     0.00007000, 0.00030000, 0.00, true,
     'https://vercel.com/ai-gateway/models', '2026-10-04T00:00:00Z',
     'Vercel AI Gateway list rate (zero markup); memory chain leg.'),
    ('vercel', 'openai/gpt-oss-120b',
     0.00035000, 0.00075000, 0.00, true,
     'https://vercel.com/ai-gateway/models', '2026-10-04T00:00:00Z',
     'Vercel AI Gateway list rate (zero markup); spare memory leg.')
ON CONFLICT (provider, model_name) DO UPDATE SET
    input_price_per_1k_tokens = EXCLUDED.input_price_per_1k_tokens,
    output_price_per_1k_tokens = EXCLUDED.output_price_per_1k_tokens,
    cencori_markup_percentage = EXCLUDED.cencori_markup_percentage,
    is_active = EXCLUDED.is_active,
    pricing_source_url = EXCLUDED.pricing_source_url,
    pricing_reviewed_at = EXCLUDED.pricing_reviewed_at,
    review_notes = EXCLUDED.review_notes,
    effective_date = now(),
    updated_at = now();

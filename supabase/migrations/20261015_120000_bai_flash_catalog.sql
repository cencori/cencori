-- B.AI flash catalog, October 2026: hide Z.AI, serve GLM + DeepSeek + Qwen via B.AI.
--
-- Companion to the lib/providers/config.ts changes in the same commit:
-- `zai` is emptied (GLM now lives under `bai`), and `bai` gains three public
-- rows — glm-5.3-flash, deepseek-v4.1-flash, qwen3.8-flash. Without an active
-- model_pricing row, getPricingFromDB fails closed and every request returns
-- 503 `pricing_unavailable`.
--
-- GLM-5.3 Flash (released 2026-08-26, 320B total / 18B active, 1M context):
-- B.AI standard reference $0.15 in / $0.50 out / $0.03 cache-read per 1M,
-- effective 2026-09-10 UTC+8. This REPLACES the 2026-08-30 row
-- ($1.00/$3.00/$0.20), which predates the standard-price update.
-- Source: https://docs.b.ai/llmservice/models/glm-5-3-flash/
--
-- DeepSeek V4.1 Flash (GA 2026-09-10, 552B backbone, 1M context, native
-- multimodal MoE): DeepSeek off-peak $0.15 in (cache miss) / $0.60 out /
-- $0.003 cache-hit per 1M; peak is 2x. The legacy `deepseek-v4-flash` /
-- `deepseek-v4-flash-vision-exp` builds were retired 2026-09-10 — DeepSeek
-- serves V4.1 behind those names — so their `bai` rows are retired here.
-- Stored at off-peak (the advertised base); peak billing is not modelled.
-- Sources: https://api-docs.deepseek.com/quick_start/pricing and
-- https://docs.b.ai/llmservice/models/deepseek-v4-1-flash
--
-- Qwen3.8 Flash (released 2026-08-26, 1M context, 131K max output):
-- $0.15 in / $0.47 out / $0.016 cache-read per 1M.
-- Sources: https://docs.b.ai/llmservice/models/qwen3-8-flash and
-- https://docs.bailian.console.aliyun.com/en/model-studio/qwen3-8-flash
--
-- Z.AI `glm-5.2` is retired: hidden from the catalog with no funded managed
-- path (the Z.AI key is unfunded). Kept restorable via BYOK.
--
-- Markup is 0.00 on all rows, matching the post-20260924 no-markup schedule.

-- Retire the hidden/legacy rows first. (Bare table name: the
-- pricing-catalog guard scrapes retirements with /UPDATE\s+model_pricing/.)
UPDATE model_pricing
SET is_active = false,
    review_notes = 'Retired 2026-10-15: zai hidden, GLM served via bai:glm-5.3-flash.',
    updated_at = NOW()
WHERE provider = 'zai'
  AND model_name IN ('glm-5.2');

UPDATE model_pricing
SET is_active = false,
    review_notes = 'Retired 2026-10-15: DeepSeek retired the V4 Flash 0731 builds on 2026-09-10; V4.1-Flash is served behind these names, priced under bai:deepseek-v4.1-flash.',
    updated_at = NOW()
WHERE provider = 'bai'
  AND model_name IN ('deepseek-v4-flash', 'deepseek-v4-flash-vision-exp');

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
    ('bai', 'glm-5.3-flash',
     0.00015000, 0.00050000, 0.00003000,
     NULL, NULL, NULL, NULL,
     0.00, true,
     'https://docs.b.ai/llmservice/models/glm-5-3-flash/', '2026-10-15T00:00:00Z',
     'GLM-5.3 Flash via B.AI, standard reference $0.15/$0.50 per 1M (cache read $0.03). Replaces the 2026-08-30 $1.00/$3.00 row.'),

    ('bai', 'deepseek-v4.1-flash',
     0.00015000, 0.00060000, 0.00000300,
     NULL, NULL, NULL, NULL,
     0.00, true,
     'https://api-docs.deepseek.com/quick_start/pricing', '2026-10-15T00:00:00Z',
     'DeepSeek V4.1 Flash via B.AI, off-peak $0.15/$0.60 per 1M (cache hit $0.003). Peak 2x not modelled. Replaces retired V4 Flash 0731 rows.'),

    ('bai', 'qwen3.8-flash',
     0.00015000, 0.00047000, 0.00001600,
     NULL, NULL, NULL, NULL,
     0.00, true,
     'https://docs.b.ai/llmservice/models/qwen3-8-flash', '2026-10-15T00:00:00Z',
     'Qwen3.8 Flash via B.AI, $0.15/$0.47 per 1M (cache read $0.016). 1M context, 131K max output.')
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

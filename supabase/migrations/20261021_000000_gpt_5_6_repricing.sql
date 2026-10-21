-- GPT-5.6 repricing (OpenAI, Aug 21 2026).
--
-- The rows from 20260715_090000_reviewed_model_pricing.sql were never updated
-- after OpenAI cut GPT-5.6 prices, so /v1/models advertised, and the gateway
-- billed, the old rates (e.g. Luna at $1/$6 instead of $0.20/$1.20). The
-- catalog (lib/providers/config.ts) and display pricing already had the new
-- numbers. Re-verified against https://developers.openai.com/api/docs/pricing
-- on 2026-10-21, standard tier, per MTok:
--
--   model          input  output  cached | >272K: input  output  cached
--   gpt-5.6-sol    4.00   20.00   0.40   |        8.00   30.00   0.80
--   gpt-5.6-terra  2.00   12.00   0.20   |        4.00   18.00   0.40
--   gpt-5.6-luna   0.20    1.20   0.02   |        0.40    1.80   0.04
--
-- Markup is left as-is (0.00 under the post-20260924 no-markup schedule).

UPDATE public.model_pricing AS mp SET
    input_price_per_1k_tokens = v.input,
    output_price_per_1k_tokens = v.output,
    cached_input_price_per_1k_tokens = v.cached,
    long_context_threshold_tokens = 272000,
    long_context_input_price_per_1k_tokens = v.lc_input,
    long_context_output_price_per_1k_tokens = v.lc_output,
    long_context_cached_input_price_per_1k_tokens = v.lc_cached,
    pricing_source_url = 'https://developers.openai.com/api/docs/pricing',
    pricing_reviewed_at = '2026-10-21T00:00:00Z',
    review_notes = 'Standard processing, Aug 21 2026 repricing; excludes batch, flex, fast mode, regional processing, cache writes, and tool fees.',
    updated_at = now()
FROM (VALUES
    ('gpt-5.6-sol',   0.00400000, 0.02000000, 0.00040000, 0.00800000, 0.03000000, 0.00080000),
    ('gpt-5.6-terra', 0.00200000, 0.01200000, 0.00020000, 0.00400000, 0.01800000, 0.00040000),
    ('gpt-5.6-luna',  0.00020000, 0.00120000, 0.00002000, 0.00040000, 0.00180000, 0.00004000)
) AS v(model_name, input, output, cached, lc_input, lc_output, lc_cached)
WHERE mp.provider = 'openai' AND mp.model_name = v.model_name;

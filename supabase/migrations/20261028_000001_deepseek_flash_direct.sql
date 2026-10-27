-- DeepSeek V4.1 Flash moves from B.AI to DeepSeek's own API (first word ~1 s
-- there against ~2-3 s on B.AI). Same off-peak rates: $0.15 in / $0.60 out per
-- 1M, cache hit $0.003 (peak 2x not modelled, as on the B.AI rows). The B.AI rows
-- stay active: B.AI is the first fallback.
insert into model_pricing (provider, model_name, input_price_per_1k_tokens, output_price_per_1k_tokens, cached_input_price_per_1k_tokens, cencori_markup_percentage, is_active, pricing_source_url, pricing_reviewed_at, review_notes)
select 'deepseek', 'deepseek-v4.1-flash', 0.00015, 0.0006, 0.000003, 0, true, 'https://api-docs.deepseek.com/quick_start/pricing', '2026-10-28', 'DeepSeek V4.1 Flash direct (API id deepseek-flash), off-peak $0.15/$0.60 per 1M, cache hit $0.003. Peak 2x not modelled.'
where not exists (select 1 from model_pricing where provider = 'deepseek' and model_name = 'deepseek-v4.1-flash');

-- The legacy id, which DeepSeek serves V4.1 Flash behind: reactivated at V4.1 rates.
update model_pricing
set input_price_per_1k_tokens = 0.00015, output_price_per_1k_tokens = 0.0006, cached_input_price_per_1k_tokens = 0.000003,
    is_active = true, pricing_reviewed_at = '2026-10-28', updated_at = now(),
    review_notes = 'Reactivated 2026-10-28: legacy id, served as V4.1 Flash on DeepSeek direct at V4.1 rates.'
where provider = 'deepseek' and model_name = 'deepseek-v4-flash';

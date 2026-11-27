-- Price the Gemini 4 family and the current Flash models (added to the catalog
-- 2026-11-26). Without an active row the gateway answers 503
-- pricing_unavailable for the model.
--
-- Rates from Google's pricing page (ai.google.dev/gemini-api/docs/pricing,
-- read 2026-11-26), Standard tier, paid, per 1M tokens. Output includes thinking
-- tokens. Gemini 4 caching is implicit only. No long-context tier is published
-- for any of these, so the long_context_* columns stay NULL.
--
--   model                  input   output  cached | from        input  output cached
--   gemini-4-argon         2.00    10.00   0.10   | 2026-12-01  4.00   20.00  0.20
--   gemini-4-carbon        2.00    10.00   0.10   | 2026-12-01  4.00   20.00  0.20
--   gemini-4-neon          3.00    15.00   0.15   |
--   gemini-4-hydrogen      1.50     7.50   0.075  |
--   gemini-3.8-flash       0.75     3.75   0.075  | 2027-01-01  1.50    7.50  0.15
--   gemini-3.5-flash-lite  0.30     2.50   0.03   |
--
-- Google says the old rates apply "through November 30, 2026" / "through
-- December 31, 2026" without a timezone; the switch is set at 00:00 UTC, which
-- bills the new rate a few hours early (Pacific) rather than late.
-- Markup column is 0: the usage markup is applied in code (lib/billing/usage-markup.ts).
-- Idempotent: updates the row if it exists, inserts it otherwise.

with v (model_name, input, output, cached, expires_at, next_input, next_output, next_cached, notes) as (values
    ('gemini-4-argon',        0.00200000, 0.01000000, 0.00010000, '2026-12-01T00:00:00Z'::timestamptz, 0.00400000, 0.02000000, 0.00020000, 'Gemini 4 Argon, GA 2026-10-13. $2/$10/$0.10 through 2026-11-30, then $4/$20/$0.20. Thinking billed as output.'),
    ('gemini-4-carbon',       0.00200000, 0.01000000, 0.00010000, '2026-12-01T00:00:00Z'::timestamptz, 0.00400000, 0.02000000, 0.00020000, 'Gemini 4 Carbon, GA 2026-11-10. $2/$10/$0.10 through 2026-11-30, then $4/$20/$0.20. Thinking billed as output.'),
    ('gemini-4-neon',         0.00300000, 0.01500000, 0.00015000, null::timestamptz, null::numeric, null::numeric, null::numeric, 'Gemini 4 Neon, GA 2026-11-18. $3/$15/$0.15. Thinking billed as output.'),
    ('gemini-4-hydrogen',     0.00150000, 0.00750000, 0.00007500, null, null, null, null, 'Gemini 4 Hydrogen, GA 2026-11-12. $1.50/$7.50/$0.075 paid tier. Thinking billed as output.'),
    ('gemini-3.8-flash',      0.00075000, 0.00375000, 0.00007500, '2027-01-01T00:00:00Z'::timestamptz, 0.00150000, 0.00750000, 0.00015000, 'Gemini 3.8 Flash, GA 2026-09-02. $0.75/$3.75/$0.075 through 2026-12-31, then $1.50/$7.50/$0.15. Cache storage not modelled.'),
    ('gemini-3.5-flash-lite', 0.00030000, 0.00250000, 0.00003000, null, null, null, null, 'Gemini 3.5 Flash-Lite, GA 2026-07-21. $0.30/$2.50/$0.03. Cache storage not modelled.')
),
updated as (
    update public.model_pricing mp set
        input_price_per_1k_tokens = v.input,
        output_price_per_1k_tokens = v.output,
        cached_input_price_per_1k_tokens = v.cached,
        cencori_markup_percentage = 0,
        is_active = true,
        pricing_source_url = 'https://ai.google.dev/gemini-api/docs/pricing',
        pricing_reviewed_at = '2026-11-26T00:00:00Z',
        pricing_expires_at = v.expires_at,
        long_context_threshold_tokens = null,
        long_context_input_price_per_1k_tokens = null,
        long_context_output_price_per_1k_tokens = null,
        long_context_cached_input_price_per_1k_tokens = null,
        next_input_price_per_1k_tokens = v.next_input,
        next_output_price_per_1k_tokens = v.next_output,
        next_cached_input_price_per_1k_tokens = v.next_cached,
        review_notes = v.notes,
        updated_at = now()
    from v
    where mp.provider = 'google' and mp.model_name = v.model_name
    returning mp.model_name
)
insert into public.model_pricing (
    provider, model_name,
    input_price_per_1k_tokens, output_price_per_1k_tokens, cached_input_price_per_1k_tokens,
    cencori_markup_percentage, is_active,
    pricing_source_url, pricing_reviewed_at, pricing_expires_at,
    next_input_price_per_1k_tokens, next_output_price_per_1k_tokens, next_cached_input_price_per_1k_tokens,
    review_notes
)
select 'google', v.model_name,
    v.input, v.output, v.cached,
    0, true,
    'https://ai.google.dev/gemini-api/docs/pricing', '2026-11-26T00:00:00Z', v.expires_at,
    v.next_input, v.next_output, v.next_cached,
    v.notes
from v
where v.model_name not in (select model_name from updated)
  and not exists (select 1 from public.model_pricing p where p.provider = 'google' and p.model_name = v.model_name);

-- B.AI legacy flash alias reactivation, October 2026.
--
-- Applied directly to production 2026-10-16 as an outage repair; recorded
-- here so fresh environments and migration replays converge on the same rows.
--
-- Background: 20261015_120000_bai_flash_catalog.sql retired
-- `bai:deepseek-v4-flash` and `bai:deepseek-v4-flash-vision-exp` on the
-- reading that DeepSeek's 2026-09-10 retirement of the V4 Flash 0731 builds
-- made those ids dead. They are not: DeepSeek still accepts both legacy names
-- and serves V4.1-Flash behind them at the Flash price — and Tensor
-- Starter/Auto still resolves onto `deepseek-v4-flash`
-- (lib/gateway/providers-setup.ts). The router kept pointing those ids at
-- `bai` while pricing was gone, so every Starter/Auto turn failed closed
-- with 503 `pricing_unavailable` before reaching upstream.
--
-- This reactivates both rows as compatibility aliases at the reviewed V4.1
-- rates (off-peak $0.15/$0.60 per 1M, cache hit $0.003; peak 2x not
-- modelled). The catalog still advertises only `deepseek-v4.1-flash`; these
-- rows exist so the legacy id bills, nothing more.
--
-- (Bare table name: the pricing-catalog guard scrapes retirements with
-- /UPDATE\s+model_pricing/ — an is_active = true write is invisible to it.)

UPDATE model_pricing
SET is_active = true,
    input_price_per_1k_tokens = 0.00015000,
    output_price_per_1k_tokens = 0.00060000,
    cached_input_price_per_1k_tokens = 0.00000300,
    cencori_markup_percentage = 0.00,
    pricing_reviewed_at = '2026-10-16T00:00:00Z',
    review_notes = 'Reactivated 2026-10-16: compat alias, served as V4.1-Flash behind the legacy id at V4.1 rates.',
    updated_at = NOW()
WHERE provider = 'bai'
  AND model_name IN ('deepseek-v4-flash', 'deepseek-v4-flash-vision-exp');

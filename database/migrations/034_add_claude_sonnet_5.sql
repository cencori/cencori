-- Migration: Add Claude Sonnet 5 Pricing
-- Description: Add pricing for the new Claude Sonnet 5 model
-- Created: 2026-06-30

INSERT INTO model_pricing (provider, model_name, input_price_per_1k_tokens, output_price_per_1k_tokens, cencori_markup_percentage) VALUES
('anthropic', 'claude-sonnet-5', 0.00300, 0.01500, 50.00)
ON CONFLICT (provider, model_name) DO UPDATE SET
    input_price_per_1k_tokens = EXCLUDED.input_price_per_1k_tokens,
    output_price_per_1k_tokens = EXCLUDED.output_price_per_1k_tokens,
    cencori_markup_percentage = EXCLUDED.cencori_markup_percentage;

-- Migration: Add Claude Opus 4.6 Pricing
-- Description: Add pricing for the new Claude Opus 4.6 model
-- Created: 2026-02-05

INSERT INTO model_pricing (provider, model_name, input_price_per_1k_tokens, output_price_per_1k_tokens, cencori_markup_percentage) VALUES
('anthropic', 'claude-opus-4.6', 0.00500, 0.02500, 50.00)
ON CONFLICT (provider, model_name) DO UPDATE SET
    input_price_per_1k_tokens = EXCLUDED.input_price_per_1k_tokens,
    output_price_per_1k_tokens = EXCLUDED.output_price_per_1k_tokens;

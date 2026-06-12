-- Migration: Add Africlaude-7B Pricing
-- Description: Add pricing for the new Africlaude-7B model from Hugging Face / Axiveri
-- Created: 2026-06-12

INSERT INTO model_pricing (provider, model_name, input_price_per_1k_tokens, output_price_per_1k_tokens, cencori_markup_percentage) VALUES
('huggingface', 'axiveri/africlaude-7b', 0.00050, 0.00100, 0.00)
ON CONFLICT (provider, model_name) DO UPDATE SET
    input_price_per_1k_tokens = EXCLUDED.input_price_per_1k_tokens,
    output_price_per_1k_tokens = EXCLUDED.output_price_per_1k_tokens,
    cencori_markup_percentage = EXCLUDED.cencori_markup_percentage;

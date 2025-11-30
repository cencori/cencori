-- Migration: Model Pricing Table
-- Description: Create pricing table for all AI providers with markup configuration
-- Created: 2025-11-30

CREATE TABLE IF NOT EXISTS model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google', 'custom'
  model_name TEXT NOT NULL, -- 'gpt-4', 'claude-3-opus-20240229', 'gemini-2.5-flash', etc.
  input_price_per_1k_tokens DECIMAL(10, 8) NOT NULL,
  output_price_per_1k_tokens DECIMAL(10, 8) NOT NULL,
  cencori_markup_percentage DECIMAL(5, 2) DEFAULT 50.00, -- 50% markup by default
  effective_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, model_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_model_pricing_provider_model ON model_pricing(provider, model_name);

-- Insert initial pricing data
INSERT INTO model_pricing (provider, model_name, input_price_per_1k_tokens, output_price_per_1k_tokens, cencori_markup_percentage) VALUES
-- OpenAI Models
('openai', 'gpt-4-turbo', 0.01000, 0.03000, 50.00),
('openai', 'gpt-4', 0.03000, 0.06000, 50.00),
('openai', 'gpt-3.5-turbo', 0.00050, 0.00150, 50.00),
('openai', 'gpt-4o', 0.00250, 0.01000, 50.00),
('openai', 'gpt-4o-mini', 0.00015, 0.00060, 50.00),

-- Anthropic Models
('anthropic', 'claude-3-opus-20240229', 0.01500, 0.07500, 50.00),
('anthropic', 'claude-3-5-sonnet-20241022', 0.00300, 0.01500, 50.00),
('anthropic', 'claude-3-sonnet-20240229', 0.00300, 0.01500, 50.00),
('anthropic', 'claude-3-haiku-20240307', 0.00025, 0.00125, 50.00),

-- Google Models (migrated from existing hardcoded pricing)
('google', 'gemini-1.5-pro', 0.00025, 0.00075, 0.00),
('google', 'gemini-2.5-flash', 0.00025, 0.00075, 0.00),
('google', 'gemini-1.5-flash', 0.000075, 0.0003, 0.00)
ON CONFLICT (provider, model_name) DO NOTHING;

-- Add comment
COMMENT ON TABLE model_pricing IS 'Pricing configuration for all AI model providers with Cencori markup';

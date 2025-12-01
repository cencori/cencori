-- Migration: Custom AI Providers
-- Description: User-configured custom AI provider endpoints and models
-- Created: 2025-11-30

-- Create custom providers table
CREATE TABLE IF NOT EXISTS custom_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  encrypted_api_key TEXT, -- encrypted with org-specific key
  api_format TEXT NOT NULL DEFAULT 'openai', -- 'openai', 'anthropic', 'custom'
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  UNIQUE(organization_id, name)
);

-- Create custom models table
CREATE TABLE IF NOT EXISTS custom_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES custom_providers(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  input_price_per_1k_tokens DECIMAL(10, 8) DEFAULT 0.00,
  output_price_per_1k_tokens DECIMAL(10, 8) DEFAULT 0.00,
  platform_fee_per_request DECIMAL(10, 4) DEFAULT 0.001, -- Cencori platform fee
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider_id, model_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_custom_providers_org ON custom_providers(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_custom_models_provider ON custom_models(provider_id, is_active);

-- Add comments
COMMENT ON TABLE custom_providers IS 'User-configured custom AI provider endpoints';
COMMENT ON TABLE custom_models IS 'Custom models associated with user providers';

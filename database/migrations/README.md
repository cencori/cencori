# Phase 2 Database Migration Guide

## Quick Run All Migrations

To run all Phase 2 migrations in order, execute this in the Supabase SQL Editor:

1. Go to your Supabase Dashboard: https://hxkbdauihjhgccfvwyvz.supabase.co
2. Navigate to SQL Editor
3. Copy and paste the entire content below and click "Run"

```sql
-- ============================================================
-- Phase 2: Multi-Model Support - Complete Migration Script
-- Run this in Supabase SQL Editor to apply all changes
-- ============================================================

-- Migration 001: Model Pricing Table
CREATE TABLE IF NOT EXISTS model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  input_price_per_1k_tokens DECIMAL(10, 8) NOT NULL,
  output_price_per_1k_tokens DECIMAL(10, 8) NOT NULL,
  cencori_markup_percentage DECIMAL(5, 2) DEFAULT 50.00,
  effective_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, model_name)
);

CREATE INDEX IF NOT EXISTS idx_model_pricing_provider_model ON model_pricing(provider, model_name);

INSERT INTO model_pricing (provider, model_name, input_price_per_1k_tokens, output_price_per_1k_tokens, cencori_markup_percentage) VALUES
('openai', 'gpt-4-turbo', 0.01000, 0.03000, 50.00),
('openai', 'gpt-4', 0.03000, 0.06000, 50.00),
('openai', 'gpt-3.5-turbo', 0.00050, 0.00150, 50.00),
('openai', 'gpt-4o', 0.00250, 0.01000, 50.00),
('openai', 'gpt-4o-mini', 0.00015, 0.00060, 50.00),
('anthropic', 'claude-3-opus-20240229', 0.01500, 0.07500, 50.00),
('anthropic', 'claude-3-5-sonnet-20241022', 0.00300, 0.01500, 50.00),
('anthropic', 'claude-3-sonnet-20240229', 0.00300, 0.01500, 50.00),
('anthropic', 'claude-3-haiku-20240307', 0.00025, 0.00125, 50.00),
('google', 'gemini-1.5-pro', 0.00025, 0.00075, 0.00),
('google', 'gemini-2.5-flash', 0.00025, 0.00075, 0.00),
('google', 'gemini-1.5-flash', 0.000075, 0.0003, 0.00)
ON CONFLICT (provider, model_name) DO NOTHING;

COMMENT ON TABLE model_pricing IS 'Pricing configuration for all AI model providers with Cencori markup';

-- Migration 002: Organization Credits System
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS credits_balance DECIMAL(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS credits_updated_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT,
  reference_id UUID,
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_org ON credit_transactions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type, created_at DESC);

COMMENT ON TABLE credit_transactions IS 'Transaction log for prepaid credits usage and top-ups';
COMMENT ON COLUMN organizations.credits_balance IS 'Prepaid credits balance in USD';

-- Migration 003: Custom AI Providers
CREATE TABLE IF NOT EXISTS custom_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  encrypted_api_key TEXT,
  api_format TEXT NOT NULL DEFAULT 'openai',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS custom_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES custom_providers(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  input_price_per_1k_tokens DECIMAL(10, 8) DEFAULT 0.00,
  output_price_per_1k_tokens DECIMAL(10, 8) DEFAULT 0.00,
  platform_fee_per_request DECIMAL(10, 4) DEFAULT 0.001,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider_id, model_name)
);

CREATE INDEX IF NOT EXISTS idx_custom_providers_org ON custom_providers(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_custom_models_provider ON custom_models(provider_id, is_active);

COMMENT ON TABLE custom_providers IS 'User-configured custom AI provider endpoints';
COMMENT ON TABLE custom_models IS 'Custom models associated with user providers';

-- Migration 004: AI Requests Updates
ALTER TABLE ai_requests 
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'google',
  ADD COLUMN IF NOT EXISTS provider_cost_usd DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS cencori_charge_usd DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS markup_percentage DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS end_user_id TEXT;

UPDATE ai_requests 
SET 
  provider = 'google',
  provider_cost_usd = cost_usd,
  cencori_charge_usd = cost_usd,
  markup_percentage = 0.00
WHERE provider IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_requests_provider ON ai_requests(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_end_user ON ai_requests(end_user_id, created_at DESC);

COMMENT ON COLUMN ai_requests.provider IS 'AI provider used: openai, anthropic, google, or custom';
COMMENT ON COLUMN ai_requests.provider_cost_usd IS 'Actual cost charged by the AI provider';
COMMENT ON COLUMN ai_requests.cencori_charge_usd IS 'Amount charged to customer (includes markup)';
COMMENT ON COLUMN ai_requests.markup_percentage IS 'Markup percentage applied by Cencori';
COMMENT ON COLUMN ai_requests.end_user_id IS 'Optional end-user identifier for multi-tenant tracking';

-- ============================================================
-- Migration Complete!
-- ============================================================
```

## Verification

After running the migrations, verify they were successful:

```sql
-- Check model_pricing table
SELECT * FROM model_pricing ORDER BY provider, model_name;

-- Check organizations has credits columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name IN ('credits_balance', 'credits_updated_at');

-- Check custom_providers table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'custom_providers'
);

-- Check ai_requests has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_requests' 
AND column_name IN ('provider', 'provider_cost_usd', 'cencori_charge_usd', 'markup_percentage', 'end_user_id');
```

## Rollback (if needed)

If you need to rollback these migrations:

```sql
-- Drop new tables
DROP TABLE IF EXISTS custom_models CASCADE;
DROP TABLE IF EXISTS custom_providers CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS model_pricing CASCADE;

-- Remove new columns
ALTER TABLE organizations 
  DROP COLUMN IF EXISTS credits_balance,
  DROP COLUMN IF EXISTS credits_updated_at;

ALTER TABLE ai_requests 
  DROP COLUMN IF EXISTS provider,
  DROP COLUMN IF EXISTS provider_cost_usd,
  DROP COLUMN IF EXISTS cencori_charge_usd,
  DROP COLUMN IF EXISTS markup_percentage,
  DROP COLUMN IF EXISTS end_user_id;
```

-- Migration: AI Requests Updates for Multi-Model Support
-- Description: Add provider tracking and cost breakdown columns
-- Created: 2025-11-30

-- Add new columns to ai_requests table
ALTER TABLE ai_requests 
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'google',
  ADD COLUMN IF NOT EXISTS provider_cost_usd DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS cencori_charge_usd DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS markup_percentage DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS end_user_id TEXT; -- optional: for customer's end-user tracking

-- Update existing records to have provider info
UPDATE ai_requests 
SET 
  provider = 'google',
  provider_cost_usd = cost_usd,
  cencori_charge_usd = cost_usd,
  markup_percentage = 0.00
WHERE provider IS NULL;

-- Create index for provider-based queries
CREATE INDEX IF NOT EXISTS idx_ai_requests_provider ON ai_requests(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_end_user ON ai_requests(end_user_id, created_at DESC);

-- Add comments
COMMENT ON COLUMN ai_requests.provider IS 'AI provider used: openai, anthropic, google, or custom';
COMMENT ON COLUMN ai_requests.provider_cost_usd IS 'Actual cost charged by the AI provider';
COMMENT ON COLUMN ai_requests.cencori_charge_usd IS 'Amount charged to customer (includes markup)';
COMMENT ON COLUMN ai_requests.markup_percentage IS 'Markup percentage applied by Cencori';
COMMENT ON COLUMN ai_requests.end_user_id IS 'Optional end-user identifier for multi-tenant tracking';

-- Migration: Organization Credits System
-- Description: Add prepaid credits system for usage-based billing
-- Created: 2025-11-30

-- Add credits balance columns to organizations table
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS credits_balance DECIMAL(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS credits_updated_at TIMESTAMP DEFAULT NOW();

-- Create credit transaction log table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL, -- positive for top-up, negative for usage
  transaction_type TEXT NOT NULL, -- 'topup', 'usage', 'refund', 'adjustment'
  description TEXT,
  reference_id UUID, -- links to ai_requests.id for usage transactions
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_org ON credit_transactions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type, created_at DESC);

-- Add comment
COMMENT ON TABLE credit_transactions IS 'Transaction log for prepaid credits usage and top-ups';
COMMENT ON COLUMN organizations.credits_balance IS 'Prepaid credits balance in USD';

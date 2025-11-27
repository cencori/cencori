-- Add subscription and usage tracking fields to organizations table

-- Add subscription fields
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' 
  CHECK (subscription_tier IN ('free', 'pro', 'team', 'enterprise'));

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' 
  CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing'));

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS subscription_id TEXT;

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS polar_customer_id TEXT;

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS subscription_current_period_start TIMESTAMP WITH TIME ZONE;

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP WITH TIME ZONE;

-- Add usage tracking fields
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS monthly_request_limit INTEGER DEFAULT 1000;

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS monthly_requests_used INTEGER DEFAULT 0;

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS usage_reset_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 month');

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_id ON organizations(subscription_id);
CREATE INDEX IF NOT EXISTS idx_organizations_polar_customer_id ON organizations(polar_customer_id);
CREATE INDEX IF NOT EXISTS idx_organizations_usage_reset ON organizations(usage_reset_at);

-- Function to reset monthly usage (called via cron or manually)
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS TABLE(org_id UUID, org_name TEXT, reset_count INTEGER) AS $$
BEGIN
    RETURN QUERY
    UPDATE organizations
    SET 
        monthly_requests_used = 0,
        usage_reset_at = NOW() + INTERVAL '1 month'
    WHERE usage_reset_at <= NOW()
    RETURNING id, name, monthly_requests_used;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON COLUMN organizations.subscription_tier IS 'Current subscription tier: free, pro, team, or enterprise';
COMMENT ON COLUMN organizations.subscription_status IS 'Subscription status from Polar: active, cancelled, past_due, trialing';
COMMENT ON COLUMN organizations.subscription_id IS 'Polar subscription ID';
COMMENT ON COLUMN organizations.polar_customer_id IS 'Polar customer ID for this organization';
COMMENT ON COLUMN organizations.monthly_request_limit IS 'Maximum requests allowed per month based on tier';
COMMENT ON COLUMN organizations.monthly_requests_used IS 'Number of requests used this month';
COMMENT ON COLUMN organizations.usage_reset_at IS 'When monthly usage counter will reset';

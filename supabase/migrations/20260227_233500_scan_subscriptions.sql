-- Standalone scan subscriptions (user-level) for Scan-only billing.
-- Platform subscriptions remain organization-level on organizations.subscription_tier.

CREATE TABLE IF NOT EXISTS scan_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scan_tier TEXT NOT NULL CHECK (scan_tier IN ('scan', 'scan_team')),
    status TEXT NOT NULL DEFAULT 'active',
    subscription_id TEXT UNIQUE,
    polar_customer_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_scan_subscriptions_user_id
    ON scan_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_scan_subscriptions_status
    ON scan_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_scan_subscriptions_polar_customer_id
    ON scan_subscriptions(polar_customer_id);

CREATE OR REPLACE FUNCTION update_scan_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scan_subscriptions_updated_at ON scan_subscriptions;
CREATE TRIGGER trigger_scan_subscriptions_updated_at
BEFORE UPDATE ON scan_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_scan_subscriptions_updated_at();

ALTER TABLE scan_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scan subscriptions"
ON scan_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scan subscriptions"
ON scan_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scan subscriptions"
ON scan_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to scan subscriptions"
ON scan_subscriptions FOR ALL
USING (auth.role() = 'service_role');

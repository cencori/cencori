-- Migration: Atomic Usage Increment RPC
-- Description: Adds a function to safely increment monthly usage while preventing race conditions.
-- Created: 2026-02-15

CREATE OR REPLACE FUNCTION increment_monthly_usage(org_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE organizations
    SET monthly_requests_used = monthly_requests_used + 1
    WHERE id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users (middleware uses client)
GRANT EXECUTE ON FUNCTION increment_monthly_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_monthly_usage(UUID) TO service_role;

-- Helpful comment
COMMENT ON FUNCTION increment_monthly_usage IS 'Atomically increments the monthly_requests_used counter for an organization.';

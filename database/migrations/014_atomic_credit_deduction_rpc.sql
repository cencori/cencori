-- Migration: Atomic Credit Deduction RPC
-- Description: Adds a function to safely deduct credits while preventing race conditions and ensuring audit integrity.
-- Created: 2026-05-06

CREATE OR REPLACE FUNCTION deduct_organization_credits(
    p_org_id UUID,
    p_amount NUMERIC,
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance NUMERIC,
    error_message TEXT
) AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    -- 1. Get current balance with a row-level lock (FOR UPDATE)
    -- This prevents other transactions from modifying this organization until we are done.
    SELECT credits_balance INTO v_current_balance
    FROM organizations
    WHERE id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0.0, 'Organization not found'::TEXT;
        RETURN;
    END IF;

    -- 2. Check for sufficient funds
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT FALSE, v_current_balance, 'Insufficient balance'::TEXT;
        RETURN;
    END IF;

    -- 3. Perform atomic update
    UPDATE organizations
    SET 
        credits_balance = credits_balance - p_amount,
        credits_updated_at = NOW()
    WHERE id = p_org_id
    RETURNING credits_balance INTO v_current_balance;

    -- 4. Log transaction
    INSERT INTO credit_transactions (
        organization_id,
        amount,
        transaction_type,
        description,
        reference_id,
        balance_before,
        balance_after,
        metadata,
        created_at
    ) VALUES (
        p_org_id,
        -p_amount,
        'usage',
        p_description,
        p_reference_id,
        v_current_balance + p_amount,
        v_current_balance,
        p_metadata,
        NOW()
    );

    RETURN QUERY SELECT TRUE, v_current_balance, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to service_role (Gateway uses this)
GRANT EXECUTE ON FUNCTION deduct_organization_credits(UUID, NUMERIC, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION deduct_organization_credits(UUID, NUMERIC, TEXT, TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION deduct_organization_credits IS 'Atomically deducts credits from an organization balance and logs the transaction.';

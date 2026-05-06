-- Migration: Atto-dollar Precision ($10^-18)
-- Description: Upgrades credit balances and transaction amounts to 18 decimal places.
-- This ensures absolute accuracy for high-volume, low-cost token billing (e.g. gpt-4o-mini).
-- Created: 2026-05-06

DO $$
BEGIN
    -- 1. Update organizations.credits_balance
    -- Using numeric(30, 18) to allow for huge balances with extreme precision
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'credits_balance'
    ) THEN
        ALTER TABLE public.organizations 
            ALTER COLUMN credits_balance TYPE numeric(30, 18)
            USING credits_balance::numeric(30, 18);
    END IF;

    -- 2. Update credit_transactions columns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_transactions') THEN
        -- amount
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'amount') THEN
            ALTER TABLE public.credit_transactions 
                ALTER COLUMN amount TYPE numeric(30, 18)
                USING amount::numeric(30, 18);
        END IF;

        -- balance_before
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'balance_before') THEN
            ALTER TABLE public.credit_transactions 
                ALTER COLUMN balance_before TYPE numeric(30, 18)
                USING balance_before::numeric(30, 18);
        END IF;

        -- balance_after
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'balance_after') THEN
            ALTER TABLE public.credit_transactions 
                ALTER COLUMN balance_after TYPE numeric(30, 18)
                USING balance_after::numeric(30, 18);
        END IF;
    END IF;

    -- 3. Update the RPC function return types to match
    -- We need to drop and recreate the function because return types are part of the signature
    DROP FUNCTION IF EXISTS deduct_organization_credits(UUID, NUMERIC, TEXT, TEXT, JSONB);
    
    CREATE OR REPLACE FUNCTION deduct_organization_credits(
        p_org_id UUID,
        p_amount NUMERIC(30, 18),
        p_description TEXT,
        p_reference_id TEXT DEFAULT NULL,
        p_metadata JSONB DEFAULT '{}'::jsonb
    )
    RETURNS TABLE (
        success BOOLEAN,
        new_balance NUMERIC(30, 18),
        error_message TEXT
    ) AS $func$
    DECLARE
        v_current_balance NUMERIC(30, 18);
    BEGIN
        -- Lock the row for update
        SELECT credits_balance INTO v_current_balance
        FROM organizations
        WHERE id = p_org_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN QUERY SELECT FALSE, 0.0::NUMERIC(30, 18), 'Organization not found'::TEXT;
            RETURN;
        END IF;

        IF v_current_balance < p_amount THEN
            RETURN QUERY SELECT FALSE, v_current_balance, 'Insufficient balance'::TEXT;
            RETURN;
        END IF;

        UPDATE organizations
        SET 
            credits_balance = credits_balance - p_amount,
            credits_updated_at = NOW()
        WHERE id = p_org_id
        RETURNING credits_balance INTO v_current_balance;

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
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Re-grant permissions
    GRANT EXECUTE ON FUNCTION deduct_organization_credits(UUID, NUMERIC, TEXT, TEXT, JSONB) TO service_role;
    GRANT EXECUTE ON FUNCTION deduct_organization_credits(UUID, NUMERIC, TEXT, TEXT, JSONB) TO authenticated;

END $$;

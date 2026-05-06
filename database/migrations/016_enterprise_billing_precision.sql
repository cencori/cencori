-- Migration: Enterprise Billing Precision & Multi-Currency Support
-- Description: Upgrades end-user usage and invoices to atto-dollar precision ($10^-18).
-- Adds currency support to rate plans and usage tracking.
-- Created: 2026-05-06

DO $$
BEGIN
    -- 1. Add currency column to rate_plans
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rate_plans' AND column_name = 'currency'
    ) THEN
        ALTER TABLE public.rate_plans ADD COLUMN currency TEXT DEFAULT 'USD';
    END IF;

    -- 2. Add currency column to end_user_usage
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'end_user_usage' AND column_name = 'currency'
    ) THEN
        ALTER TABLE public.end_user_usage ADD COLUMN currency TEXT DEFAULT 'USD';
    END IF;

    -- 3. Upgrade end_user_usage precision
    ALTER TABLE public.end_user_usage 
        ALTER COLUMN total_cost_usd TYPE numeric(30, 18),
        ALTER COLUMN provider_cost_usd TYPE numeric(30, 18),
        ALTER COLUMN customer_charge_usd TYPE numeric(30, 18);

    -- 4. Upgrade end_user_invoices precision
    ALTER TABLE public.end_user_invoices 
        ALTER COLUMN subtotal_usd TYPE numeric(30, 18),
        ALTER COLUMN markup_usd TYPE numeric(30, 18),
        ALTER COLUMN total_usd TYPE numeric(30, 18);

    -- 5. Update increment_end_user_usage RPC signature
    DROP FUNCTION IF EXISTS increment_end_user_usage(UUID, TEXT, BIGINT, BIGINT, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT);

    CREATE OR REPLACE FUNCTION increment_end_user_usage(
        p_project_id UUID,
        p_external_user_id TEXT,
        p_prompt_tokens BIGINT,
        p_completion_tokens BIGINT,
        p_total_cost_usd NUMERIC(30, 18),
        p_provider_cost_usd NUMERIC(30, 18),
        p_customer_charge_usd NUMERIC(30, 18) DEFAULT 0,
        p_display_name TEXT DEFAULT NULL,
        p_email TEXT DEFAULT NULL
    )
    RETURNS JSONB AS $func$
    DECLARE
        v_end_user_id UUID;
        v_total_tokens BIGINT;
        v_today DATE := CURRENT_DATE;
        v_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
        v_daily_usage end_user_usage%ROWTYPE;
        v_monthly_usage end_user_usage%ROWTYPE;
    BEGIN
        v_total_tokens := p_prompt_tokens + p_completion_tokens;

        -- Upsert end-user
        INSERT INTO end_users (project_id, external_id, display_name, email, last_seen_at)
        VALUES (p_project_id, p_external_user_id, p_display_name, p_email, NOW())
        ON CONFLICT (project_id, external_id) DO UPDATE SET
            last_seen_at = NOW(),
            display_name = COALESCE(EXCLUDED.display_name, end_users.display_name),
            email = COALESCE(EXCLUDED.email, end_users.email)
        RETURNING id INTO v_end_user_id;

        -- Upsert daily usage
        INSERT INTO end_user_usage (project_id, end_user_id, period_type, period_start,
            total_requests, total_tokens, prompt_tokens, completion_tokens,
            total_cost_usd, provider_cost_usd, customer_charge_usd, updated_at)
        VALUES (p_project_id, v_end_user_id, 'daily', v_today,
            1, v_total_tokens, p_prompt_tokens, p_completion_tokens,
            p_total_cost_usd, p_provider_cost_usd, p_customer_charge_usd, NOW())
        ON CONFLICT (end_user_id, period_type, period_start) DO UPDATE SET
            total_requests = end_user_usage.total_requests + 1,
            total_tokens = end_user_usage.total_tokens + v_total_tokens,
            prompt_tokens = end_user_usage.prompt_tokens + p_prompt_tokens,
            completion_tokens = end_user_usage.completion_tokens + p_completion_tokens,
            total_cost_usd = end_user_usage.total_cost_usd + p_total_cost_usd,
            provider_cost_usd = end_user_usage.provider_cost_usd + p_provider_cost_usd,
            customer_charge_usd = end_user_usage.customer_charge_usd + p_customer_charge_usd,
            updated_at = NOW()
        RETURNING * INTO v_daily_usage;

        -- Upsert monthly usage
        INSERT INTO end_user_usage (project_id, end_user_id, period_type, period_start,
            total_requests, total_tokens, prompt_tokens, completion_tokens,
            total_cost_usd, provider_cost_usd, customer_charge_usd, updated_at)
        VALUES (p_project_id, v_end_user_id, 'monthly', v_month_start,
            1, v_total_tokens, p_prompt_tokens, p_completion_tokens,
            p_total_cost_usd, p_provider_cost_usd, p_customer_charge_usd, NOW())
        ON CONFLICT (end_user_id, period_type, period_start) DO UPDATE SET
            total_requests = end_user_usage.total_requests + 1,
            total_tokens = end_user_usage.total_tokens + v_total_tokens,
            prompt_tokens = end_user_usage.prompt_tokens + p_prompt_tokens,
            completion_tokens = end_user_usage.completion_tokens + p_completion_tokens,
            total_cost_usd = end_user_usage.total_cost_usd + p_total_cost_usd,
            provider_cost_usd = end_user_usage.provider_cost_usd + p_provider_cost_usd,
            customer_charge_usd = end_user_usage.customer_charge_usd + p_customer_charge_usd,
            updated_at = NOW()
        RETURNING * INTO v_monthly_usage;

        RETURN jsonb_build_object(
            'end_user_id', v_end_user_id,
            'daily', jsonb_build_object(
                'total_requests', v_daily_usage.total_requests,
                'total_tokens', v_daily_usage.total_tokens,
                'total_cost_usd', v_daily_usage.total_cost_usd
            ),
            'monthly', jsonb_build_object(
                'total_requests', v_monthly_usage.total_requests,
                'total_tokens', v_monthly_usage.total_tokens,
                'total_cost_usd', v_monthly_usage.total_cost_usd
            )
        );
    END;
    $func$ LANGUAGE plpgsql;

    GRANT EXECUTE ON FUNCTION increment_end_user_usage(UUID, TEXT, BIGINT, BIGINT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO service_role;

END $$;

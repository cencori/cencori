-- Migration: Platform Commission RPC Support
-- Description: Updates the usage increment RPC to track Cencori's platform commission.
-- Created: 2026-05-06

DROP FUNCTION IF EXISTS increment_end_user_usage(UUID, TEXT, BIGINT, BIGINT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION increment_end_user_usage(
    p_project_id UUID,
    p_external_user_id TEXT,
    p_prompt_tokens BIGINT,
    p_completion_tokens BIGINT,
    p_total_cost_usd NUMERIC(30, 18),
    p_provider_cost_usd NUMERIC(30, 18),
    p_customer_charge_usd NUMERIC(30, 18) DEFAULT 0,
    p_platform_commission_usd NUMERIC(30, 18) DEFAULT 0,
    p_currency TEXT DEFAULT 'USD',
    p_display_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_environment TEXT DEFAULT 'production'
)
RETURNS JSONB AS $func$
DECLARE
    v_env TEXT := COALESCE(NULLIF(p_environment, ''), 'production');
    v_end_user_id UUID;
    v_total_tokens BIGINT := p_prompt_tokens + p_completion_tokens;
    v_today DATE := CURRENT_DATE;
    v_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
BEGIN
    -- Sync user identity
    INSERT INTO end_users (project_id, external_id, display_name, email, last_seen_at)
    VALUES (p_project_id, p_external_user_id, p_display_name, p_email, NOW())
    ON CONFLICT (project_id, external_id) DO UPDATE SET 
        last_seen_at = NOW(),
        display_name = COALESCE(EXCLUDED.display_name, end_users.display_name),
        email = COALESCE(EXCLUDED.email, end_users.email)
    RETURNING id INTO v_end_user_id;

    -- Record Daily Usage
    INSERT INTO end_user_usage (project_id, end_user_id, environment, period_type, period_start, currency,
        total_requests, total_tokens, prompt_tokens, completion_tokens,
        total_cost_usd, provider_cost_usd, customer_charge_usd, platform_commission_usd, updated_at)
    VALUES (p_project_id, v_end_user_id, v_env, 'daily', v_today, p_currency,
        1, v_total_tokens, p_prompt_tokens, p_completion_tokens,
        p_total_cost_usd, p_provider_cost_usd, p_customer_charge_usd, p_platform_commission_usd, NOW())
    ON CONFLICT (end_user_id, environment, period_type, period_start, currency) DO UPDATE SET
        total_requests = end_user_usage.total_requests + 1,
        total_tokens = end_user_usage.total_tokens + v_total_tokens,
        total_cost_usd = end_user_usage.total_cost_usd + p_total_cost_usd,
        customer_charge_usd = end_user_usage.customer_charge_usd + p_customer_charge_usd,
        platform_commission_usd = COALESCE(end_user_usage.platform_commission_usd, 0) + p_platform_commission_usd,
        updated_at = NOW();

    -- Record Monthly Usage
    INSERT INTO end_user_usage (project_id, end_user_id, environment, period_type, period_start, currency,
        total_requests, total_tokens, prompt_tokens, completion_tokens,
        total_cost_usd, provider_cost_usd, customer_charge_usd, platform_commission_usd, updated_at)
    VALUES (p_project_id, v_end_user_id, v_env, 'monthly', v_month_start, p_currency,
        1, v_total_tokens, p_prompt_tokens, p_completion_tokens,
        p_total_cost_usd, p_provider_cost_usd, p_customer_charge_usd, p_platform_commission_usd, NOW())
    ON CONFLICT (end_user_id, environment, period_type, period_start, currency) DO UPDATE SET
        total_requests = end_user_usage.total_requests + 1,
        total_tokens = end_user_usage.total_tokens + v_total_tokens,
        total_cost_usd = end_user_usage.total_cost_usd + p_total_cost_usd,
        customer_charge_usd = end_user_usage.customer_charge_usd + p_customer_charge_usd,
        platform_commission_usd = COALESCE(end_user_usage.platform_commission_usd, 0) + p_platform_commission_usd,
        updated_at = NOW();

    RETURN jsonb_build_object('success', true, 'end_user_id', v_end_user_id, 'currency', p_currency);
END;
$func$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION increment_end_user_usage(UUID, TEXT, BIGINT, BIGINT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO service_role;

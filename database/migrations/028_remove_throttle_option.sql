-- Remove the 'throttle' overage_action option from rate_plans.
-- Throttle was never meaningfully distinct from block — migration 027 made it
-- return allowed=false (identical to block). Rather than ship a half-implemented
-- feature, we collapse it into block and restrict the CHECK to two honest options.

-- 1. Migrate existing throttle rows to block
UPDATE rate_plans
SET overage_action = 'block', updated_at = NOW()
WHERE overage_action = 'throttle';

-- 2. Replace the CHECK constraint
ALTER TABLE rate_plans DROP CONSTRAINT IF EXISTS rate_plans_overage_action_check;
ALTER TABLE rate_plans ADD CONSTRAINT rate_plans_overage_action_check
    CHECK (overage_action IN ('block', 'alert_only'));

-- 3. Update the RPC to remove the throttle branch
CREATE OR REPLACE FUNCTION check_end_user_quota(
    p_project_id UUID,
    p_external_user_id TEXT,
    p_environment TEXT DEFAULT 'production'
)
RETURNS JSONB AS $$
DECLARE
    v_environment TEXT := COALESCE(NULLIF(p_environment, ''), 'production');
    v_end_user end_users%ROWTYPE;
    v_plan rate_plans%ROWTYPE;
    v_daily_usage end_user_usage%ROWTYPE;
    v_monthly_usage end_user_usage%ROWTYPE;
    v_today DATE := CURRENT_DATE;
    v_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
    v_reason TEXT;
    v_base JSONB;
    v_minute_request_count INTEGER := 0;
    v_oldest_recent_request TIMESTAMPTZ;
    v_retry_after_seconds INTEGER;
BEGIN
    SELECT * INTO v_end_user
    FROM end_users
    WHERE project_id = p_project_id
      AND external_id = p_external_user_id;

    IF v_end_user IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'reason', 'new_user',
            'is_new_user', true,
            'markup_percentage', 0,
            'flat_rate_per_request', NULL,
            'allowed_models', NULL,
            'daily_tokens_used', 0,
            'daily_tokens_limit', NULL,
            'monthly_tokens_used', 0,
            'monthly_tokens_limit', NULL,
            'daily_requests_used', 0,
            'daily_requests_limit', NULL,
            'monthly_requests_used', 0,
            'monthly_requests_limit', NULL,
            'requests_per_minute_used', 0,
            'requests_per_minute_limit', NULL,
            'retry_after_seconds', NULL
        );
    END IF;

    IF v_end_user.is_blocked THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'user_blocked',
            'is_new_user', false,
            'end_user_id', v_end_user.id,
            'markup_percentage', 0,
            'flat_rate_per_request', NULL,
            'allowed_models', NULL,
            'daily_tokens_used', 0,
            'daily_tokens_limit', NULL,
            'monthly_tokens_used', 0,
            'monthly_tokens_limit', NULL,
            'daily_requests_used', 0,
            'daily_requests_limit', NULL,
            'monthly_requests_used', 0,
            'monthly_requests_limit', NULL,
            'requests_per_minute_used', 0,
            'requests_per_minute_limit', NULL,
            'retry_after_seconds', NULL
        );
    END IF;

    IF v_end_user.rate_plan_id IS NOT NULL THEN
        SELECT * INTO v_plan
        FROM rate_plans
        WHERE id = v_end_user.rate_plan_id
          AND is_active = true;
    ELSE
        SELECT * INTO v_plan
        FROM rate_plans
        WHERE project_id = p_project_id
          AND is_default = true
          AND is_active = true
        LIMIT 1;
    END IF;

    IF v_plan IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'reason', 'no_rate_plan',
            'is_new_user', false,
            'end_user_id', v_end_user.id,
            'markup_percentage', 0,
            'flat_rate_per_request', NULL,
            'allowed_models', NULL,
            'daily_tokens_used', 0,
            'daily_tokens_limit', NULL,
            'monthly_tokens_used', 0,
            'monthly_tokens_limit', NULL,
            'daily_requests_used', 0,
            'daily_requests_limit', NULL,
            'monthly_requests_used', 0,
            'monthly_requests_limit', NULL,
            'requests_per_minute_used', 0,
            'requests_per_minute_limit', NULL,
            'retry_after_seconds', NULL
        );
    END IF;

    IF v_plan.requests_per_minute IS NOT NULL THEN
        SELECT COUNT(*)::INTEGER, MIN(created_at)
        INTO v_minute_request_count, v_oldest_recent_request
        FROM ai_requests
        WHERE project_id = p_project_id
          AND COALESCE(environment, 'production') = v_environment
          AND end_user_id = p_external_user_id
          AND created_at >= NOW() - INTERVAL '60 seconds';
    END IF;

    SELECT * INTO v_daily_usage
    FROM end_user_usage
    WHERE end_user_id = v_end_user.id
      AND environment = v_environment
      AND period_type = 'daily'
      AND period_start = v_today;

    SELECT * INTO v_monthly_usage
    FROM end_user_usage
    WHERE end_user_id = v_end_user.id
      AND environment = v_environment
      AND period_type = 'monthly'
      AND period_start = v_month_start;

    IF v_plan.requests_per_minute IS NOT NULL
       AND v_minute_request_count >= v_plan.requests_per_minute THEN
        v_reason := 'requests_per_minute_exceeded';
        v_retry_after_seconds := GREATEST(
            1,
            COALESCE(
                CEIL(EXTRACT(EPOCH FROM ((v_oldest_recent_request + INTERVAL '60 seconds') - NOW())))::INTEGER,
                60
            )
        );
    ELSIF v_plan.daily_token_limit IS NOT NULL
       AND COALESCE(v_daily_usage.total_tokens, 0) >= v_plan.daily_token_limit THEN
        v_reason := 'daily_token_limit_exceeded';
        v_retry_after_seconds := GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM ((date_trunc('day', NOW()) + INTERVAL '1 day') - NOW())))::INTEGER
        );
    ELSIF v_plan.monthly_token_limit IS NOT NULL
       AND COALESCE(v_monthly_usage.total_tokens, 0) >= v_plan.monthly_token_limit THEN
        v_reason := 'monthly_token_limit_exceeded';
        v_retry_after_seconds := GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM ((date_trunc('month', NOW()) + INTERVAL '1 month') - NOW())))::INTEGER
        );
    ELSIF v_plan.daily_request_limit IS NOT NULL
       AND COALESCE(v_daily_usage.total_requests, 0) >= v_plan.daily_request_limit THEN
        v_reason := 'daily_request_limit_exceeded';
        v_retry_after_seconds := GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM ((date_trunc('day', NOW()) + INTERVAL '1 day') - NOW())))::INTEGER
        );
    ELSIF v_plan.monthly_request_limit IS NOT NULL
       AND COALESCE(v_monthly_usage.total_requests, 0) >= v_plan.monthly_request_limit THEN
        v_reason := 'monthly_request_limit_exceeded';
        v_retry_after_seconds := GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM ((date_trunc('month', NOW()) + INTERVAL '1 month') - NOW())))::INTEGER
        );
    ELSIF v_plan.daily_cost_limit_usd IS NOT NULL
       AND COALESCE(v_daily_usage.total_cost_usd, 0) >= v_plan.daily_cost_limit_usd THEN
        v_reason := 'daily_cost_limit_exceeded';
        v_retry_after_seconds := GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM ((date_trunc('day', NOW()) + INTERVAL '1 day') - NOW())))::INTEGER
        );
    ELSIF v_plan.monthly_cost_limit_usd IS NOT NULL
       AND COALESCE(v_monthly_usage.total_cost_usd, 0) >= v_plan.monthly_cost_limit_usd THEN
        v_reason := 'monthly_cost_limit_exceeded';
        v_retry_after_seconds := GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM ((date_trunc('month', NOW()) + INTERVAL '1 month') - NOW())))::INTEGER
        );
    END IF;

    v_base := jsonb_build_object(
        'is_new_user', false,
        'end_user_id', v_end_user.id,
        'rate_plan', v_plan.name,
        'overage_action', v_plan.overage_action,
        'markup_percentage', COALESCE(v_plan.markup_percentage, 0),
        'flat_rate_per_request', v_plan.flat_rate_per_request,
        'allowed_models', v_plan.allowed_models,
        'daily_tokens_used', COALESCE(v_daily_usage.total_tokens, 0),
        'daily_tokens_limit', v_plan.daily_token_limit,
        'monthly_tokens_used', COALESCE(v_monthly_usage.total_tokens, 0),
        'monthly_tokens_limit', v_plan.monthly_token_limit,
        'daily_requests_used', COALESCE(v_daily_usage.total_requests, 0),
        'daily_requests_limit', v_plan.daily_request_limit,
        'monthly_requests_used', COALESCE(v_monthly_usage.total_requests, 0),
        'monthly_requests_limit', v_plan.monthly_request_limit,
        'requests_per_minute_used', v_minute_request_count,
        'requests_per_minute_limit', v_plan.requests_per_minute,
        'retry_after_seconds', v_retry_after_seconds
    );

    IF v_reason IS NULL THEN
        RETURN v_base || jsonb_build_object('allowed', true, 'reason', 'within_limits');
    END IF;

    IF v_plan.overage_action = 'alert_only' THEN
        RETURN v_base || jsonb_build_object(
            'allowed', true,
            'reason', v_reason,
            'retry_after_seconds', NULL
        );
    ELSE
        -- block
        RETURN v_base || jsonb_build_object('allowed', false, 'reason', v_reason);
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

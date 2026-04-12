-- End-user billing runtime fixes:
-- - scope quota accounting by environment
-- - enforce per-plan requests_per_minute
-- - make throttle return a real retryable denial instead of acting like alert_only

ALTER TABLE end_user_usage
ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production'
CHECK (environment IN ('production', 'test'));

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'end_user_usage'::regclass
          AND conname = 'end_user_usage_end_user_id_period_type_period_start_key'
    ) THEN
        ALTER TABLE end_user_usage
        DROP CONSTRAINT end_user_usage_end_user_id_period_type_period_start_key;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'end_user_usage'::regclass
          AND conname = 'end_user_usage_end_user_id_environment_period_type_period_start_key'
    ) THEN
        ALTER TABLE end_user_usage
        ADD CONSTRAINT end_user_usage_end_user_id_environment_period_type_period_start_key
        UNIQUE (end_user_id, environment, period_type, period_start);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_end_user_usage_user_env_period
ON end_user_usage(end_user_id, environment, period_type, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_end_user_usage_project_env_period
ON end_user_usage(project_id, environment, period_type, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_ai_requests_project_env_end_user_created
ON ai_requests(project_id, environment, end_user_id, created_at DESC)
WHERE end_user_id IS NOT NULL;

DROP FUNCTION IF EXISTS check_end_user_quota(UUID, TEXT);

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
    ELSIF v_plan.overage_action = 'throttle' THEN
        RETURN v_base || jsonb_build_object('allowed', false, 'reason', v_reason);
    ELSE
        RETURN v_base || jsonb_build_object('allowed', false, 'reason', v_reason);
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

DROP FUNCTION IF EXISTS increment_end_user_usage(UUID, TEXT, BIGINT, BIGINT, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT);

CREATE OR REPLACE FUNCTION increment_end_user_usage(
    p_project_id UUID,
    p_external_user_id TEXT,
    p_prompt_tokens BIGINT,
    p_completion_tokens BIGINT,
    p_total_cost_usd DECIMAL(12,6),
    p_provider_cost_usd DECIMAL(12,6),
    p_customer_charge_usd DECIMAL(12,6) DEFAULT 0,
    p_display_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_environment TEXT DEFAULT 'production'
)
RETURNS JSONB AS $$
DECLARE
    v_environment TEXT := COALESCE(NULLIF(p_environment, ''), 'production');
    v_end_user_id UUID;
    v_total_tokens BIGINT;
    v_today DATE := CURRENT_DATE;
    v_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
    v_daily_usage end_user_usage%ROWTYPE;
    v_monthly_usage end_user_usage%ROWTYPE;
BEGIN
    v_total_tokens := p_prompt_tokens + p_completion_tokens;

    INSERT INTO end_users (project_id, external_id, display_name, email, last_seen_at)
    VALUES (p_project_id, p_external_user_id, p_display_name, p_email, NOW())
    ON CONFLICT (project_id, external_id) DO UPDATE SET
        last_seen_at = NOW(),
        display_name = COALESCE(EXCLUDED.display_name, end_users.display_name),
        email = COALESCE(EXCLUDED.email, end_users.email)
    RETURNING id INTO v_end_user_id;

    INSERT INTO end_user_usage (
        project_id,
        end_user_id,
        environment,
        period_type,
        period_start,
        total_requests,
        total_tokens,
        prompt_tokens,
        completion_tokens,
        total_cost_usd,
        provider_cost_usd,
        customer_charge_usd,
        updated_at
    )
    VALUES (
        p_project_id,
        v_end_user_id,
        v_environment,
        'daily',
        v_today,
        1,
        v_total_tokens,
        p_prompt_tokens,
        p_completion_tokens,
        p_total_cost_usd,
        p_provider_cost_usd,
        p_customer_charge_usd,
        NOW()
    )
    ON CONFLICT (end_user_id, environment, period_type, period_start) DO UPDATE SET
        total_requests = end_user_usage.total_requests + 1,
        total_tokens = end_user_usage.total_tokens + v_total_tokens,
        prompt_tokens = end_user_usage.prompt_tokens + p_prompt_tokens,
        completion_tokens = end_user_usage.completion_tokens + p_completion_tokens,
        total_cost_usd = end_user_usage.total_cost_usd + p_total_cost_usd,
        provider_cost_usd = end_user_usage.provider_cost_usd + p_provider_cost_usd,
        customer_charge_usd = end_user_usage.customer_charge_usd + p_customer_charge_usd,
        updated_at = NOW()
    RETURNING * INTO v_daily_usage;

    INSERT INTO end_user_usage (
        project_id,
        end_user_id,
        environment,
        period_type,
        period_start,
        total_requests,
        total_tokens,
        prompt_tokens,
        completion_tokens,
        total_cost_usd,
        provider_cost_usd,
        customer_charge_usd,
        updated_at
    )
    VALUES (
        p_project_id,
        v_end_user_id,
        v_environment,
        'monthly',
        v_month_start,
        1,
        v_total_tokens,
        p_prompt_tokens,
        p_completion_tokens,
        p_total_cost_usd,
        p_provider_cost_usd,
        p_customer_charge_usd,
        NOW()
    )
    ON CONFLICT (end_user_id, environment, period_type, period_start) DO UPDATE SET
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
        'environment', v_environment,
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
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION check_end_user_quota(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_end_user_quota(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION increment_end_user_usage(UUID, TEXT, BIGINT, BIGINT, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT, TEXT) TO service_role;

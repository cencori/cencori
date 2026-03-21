-- Usage-based billing: end-user tracking, rate plans, usage aggregation, Stripe Connect, invoicing
-- Enables Cencori customers to meter, limit, and bill their own end-users

-- ============================================================================
-- 1. rate_plans — usage tiers customers define for their end-users
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,

    -- Token limits
    daily_token_limit BIGINT,
    monthly_token_limit BIGINT,

    -- Request limits
    daily_request_limit INTEGER,
    monthly_request_limit INTEGER,
    requests_per_minute INTEGER,

    -- Cost limits
    daily_cost_limit_usd DECIMAL(10,4),
    monthly_cost_limit_usd DECIMAL(10,4),

    -- Pricing
    markup_percentage DECIMAL(5,2) DEFAULT 0.00,
    flat_rate_per_request DECIMAL(10,6),

    -- Model restrictions
    allowed_models TEXT[],

    -- Behaviour when limits are exceeded
    overage_action TEXT NOT NULL DEFAULT 'block'
        CHECK (overage_action IN ('block', 'throttle', 'alert_only')),

    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(project_id, slug)
);

CREATE INDEX idx_rate_plans_project ON rate_plans(project_id);
CREATE INDEX idx_rate_plans_project_default ON rate_plans(project_id) WHERE is_default = true;

-- ============================================================================
-- 2. end_users — tracks end-users of Cencori's customers
-- ============================================================================

CREATE TABLE IF NOT EXISTS end_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    display_name TEXT,
    email TEXT,
    rate_plan_id UUID REFERENCES rate_plans(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    is_blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, external_id)
);

CREATE INDEX idx_end_users_project_external ON end_users(project_id, external_id);
CREATE INDEX idx_end_users_project_last_seen ON end_users(project_id, last_seen_at DESC);
CREATE INDEX idx_end_users_rate_plan ON end_users(rate_plan_id) WHERE rate_plan_id IS NOT NULL;

-- ============================================================================
-- 3. end_user_usage — aggregated usage per period (daily / monthly)
-- ============================================================================

CREATE TABLE IF NOT EXISTS end_user_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    end_user_id UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,

    period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'monthly')),
    period_start DATE NOT NULL,

    total_requests INTEGER DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    prompt_tokens BIGINT DEFAULT 0,
    completion_tokens BIGINT DEFAULT 0,

    total_cost_usd DECIMAL(12,6) DEFAULT 0,
    provider_cost_usd DECIMAL(12,6) DEFAULT 0,
    customer_charge_usd DECIMAL(12,6) DEFAULT 0,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(end_user_id, period_type, period_start)
);

CREATE INDEX idx_end_user_usage_project ON end_user_usage(project_id);
CREATE INDEX idx_end_user_usage_user_period ON end_user_usage(end_user_id, period_type, period_start DESC);
CREATE INDEX idx_end_user_usage_project_period ON end_user_usage(project_id, period_type, period_start DESC);

-- ============================================================================
-- 4. stripe_connect_accounts — Stripe Connect for customer billing
-- ============================================================================

CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    stripe_account_id TEXT NOT NULL UNIQUE,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'restricted', 'disabled')),

    charges_enabled BOOLEAN DEFAULT false,
    payouts_enabled BOOLEAN DEFAULT false,
    onboarding_completed BOOLEAN DEFAULT false,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stripe_connect_org ON stripe_connect_accounts(organization_id);
CREATE INDEX idx_stripe_connect_stripe_id ON stripe_connect_accounts(stripe_account_id);

-- ============================================================================
-- 5. end_user_invoices — invoices generated for end-users
-- ============================================================================

CREATE TABLE IF NOT EXISTS end_user_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    end_user_id UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,

    stripe_invoice_id TEXT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    total_requests INTEGER DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,

    subtotal_usd DECIMAL(10,4) DEFAULT 0,
    markup_usd DECIMAL(10,4) DEFAULT 0,
    total_usd DECIMAL(10,4) DEFAULT 0,

    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'paid', 'void', 'overdue')),

    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    line_items JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_end_user_invoices_project ON end_user_invoices(project_id);
CREATE INDEX idx_end_user_invoices_end_user ON end_user_invoices(end_user_id);
CREATE INDEX idx_end_user_invoices_status ON end_user_invoices(project_id, status);
CREATE INDEX idx_end_user_invoices_period ON end_user_invoices(project_id, period_start, period_end);
CREATE INDEX idx_end_user_invoices_stripe ON end_user_invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

-- ============================================================================
-- 6. ALTER projects — add billing columns
-- ============================================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_user_billing_enabled BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_rate_plan_id UUID REFERENCES rate_plans(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_markup_percentage DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly'
    CHECK (billing_cycle IN ('daily', 'weekly', 'monthly'));

-- ============================================================================
-- 7. RPC: check_end_user_quota
-- ============================================================================

CREATE OR REPLACE FUNCTION check_end_user_quota(
    p_project_id UUID,
    p_external_user_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_end_user end_users%ROWTYPE;
    v_plan rate_plans%ROWTYPE;
    v_daily_usage end_user_usage%ROWTYPE;
    v_monthly_usage end_user_usage%ROWTYPE;
    v_today DATE := CURRENT_DATE;
    v_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
    v_reason TEXT;
BEGIN
    -- Look up the end-user
    SELECT * INTO v_end_user
    FROM end_users
    WHERE project_id = p_project_id AND external_id = p_external_user_id;

    -- Unknown user → allowed (will be auto-created on first usage)
    IF v_end_user IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', true, 'reason', 'new_user', 'is_new_user', true,
            'markup_percentage', 0, 'flat_rate_per_request', NULL, 'allowed_models', NULL,
            'daily_tokens_used', 0, 'daily_tokens_limit', NULL,
            'monthly_tokens_used', 0, 'monthly_tokens_limit', NULL,
            'daily_requests_used', 0, 'daily_requests_limit', NULL,
            'monthly_requests_used', 0, 'monthly_requests_limit', NULL
        );
    END IF;

    -- Blocked user
    IF v_end_user.is_blocked THEN
        RETURN jsonb_build_object(
            'allowed', false, 'reason', 'user_blocked', 'is_new_user', false,
            'end_user_id', v_end_user.id,
            'markup_percentage', 0, 'flat_rate_per_request', NULL, 'allowed_models', NULL,
            'daily_tokens_used', 0, 'daily_tokens_limit', NULL,
            'monthly_tokens_used', 0, 'monthly_tokens_limit', NULL,
            'daily_requests_used', 0, 'daily_requests_limit', NULL,
            'monthly_requests_used', 0, 'monthly_requests_limit', NULL
        );
    END IF;

    -- Resolve rate plan: explicit > project default > no limits
    IF v_end_user.rate_plan_id IS NOT NULL THEN
        SELECT * INTO v_plan FROM rate_plans WHERE id = v_end_user.rate_plan_id AND is_active = true;
    ELSE
        SELECT * INTO v_plan
        FROM rate_plans
        WHERE project_id = p_project_id AND is_default = true AND is_active = true
        LIMIT 1;
    END IF;

    -- No plan → no limits
    IF v_plan IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', true, 'reason', 'no_rate_plan', 'is_new_user', false,
            'end_user_id', v_end_user.id,
            'markup_percentage', 0, 'flat_rate_per_request', NULL, 'allowed_models', NULL,
            'daily_tokens_used', 0, 'daily_tokens_limit', NULL,
            'monthly_tokens_used', 0, 'monthly_tokens_limit', NULL,
            'daily_requests_used', 0, 'daily_requests_limit', NULL,
            'monthly_requests_used', 0, 'monthly_requests_limit', NULL
        );
    END IF;

    -- Fetch current daily usage
    SELECT * INTO v_daily_usage
    FROM end_user_usage
    WHERE end_user_id = v_end_user.id AND period_type = 'daily' AND period_start = v_today;

    -- Fetch current monthly usage
    SELECT * INTO v_monthly_usage
    FROM end_user_usage
    WHERE end_user_id = v_end_user.id AND period_type = 'monthly' AND period_start = v_month_start;

    -- Check daily token limit
    IF v_plan.daily_token_limit IS NOT NULL
       AND COALESCE(v_daily_usage.total_tokens, 0) >= v_plan.daily_token_limit THEN
        v_reason := 'daily_token_limit_exceeded';
    -- Check monthly token limit
    ELSIF v_plan.monthly_token_limit IS NOT NULL
       AND COALESCE(v_monthly_usage.total_tokens, 0) >= v_plan.monthly_token_limit THEN
        v_reason := 'monthly_token_limit_exceeded';
    -- Check daily request limit
    ELSIF v_plan.daily_request_limit IS NOT NULL
       AND COALESCE(v_daily_usage.total_requests, 0) >= v_plan.daily_request_limit THEN
        v_reason := 'daily_request_limit_exceeded';
    -- Check monthly request limit
    ELSIF v_plan.monthly_request_limit IS NOT NULL
       AND COALESCE(v_monthly_usage.total_requests, 0) >= v_plan.monthly_request_limit THEN
        v_reason := 'monthly_request_limit_exceeded';
    -- Check daily cost limit
    ELSIF v_plan.daily_cost_limit_usd IS NOT NULL
       AND COALESCE(v_daily_usage.total_cost_usd, 0) >= v_plan.daily_cost_limit_usd THEN
        v_reason := 'daily_cost_limit_exceeded';
    -- Check monthly cost limit
    ELSIF v_plan.monthly_cost_limit_usd IS NOT NULL
       AND COALESCE(v_monthly_usage.total_cost_usd, 0) >= v_plan.monthly_cost_limit_usd THEN
        v_reason := 'monthly_cost_limit_exceeded';
    END IF;

    -- Build the base response (flat structure matching lib/end-user-billing.ts)
    DECLARE v_base JSONB;
    BEGIN
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
            'monthly_requests_limit', v_plan.monthly_request_limit
        );

        -- No limit hit
        IF v_reason IS NULL THEN
            RETURN v_base || jsonb_build_object('allowed', true, 'reason', 'within_limits');
        END IF;

        -- Limit exceeded — respect overage_action
        IF v_plan.overage_action = 'alert_only' THEN
            RETURN v_base || jsonb_build_object('allowed', true, 'reason', v_reason);
        ELSIF v_plan.overage_action = 'throttle' THEN
            RETURN v_base || jsonb_build_object('allowed', true, 'reason', v_reason);
        ELSE
            -- block
            RETURN v_base || jsonb_build_object('allowed', false, 'reason', v_reason);
        END IF;
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 8. RPC: increment_end_user_usage
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_end_user_usage(
    p_project_id UUID,
    p_external_user_id TEXT,
    p_prompt_tokens BIGINT,
    p_completion_tokens BIGINT,
    p_total_cost_usd DECIMAL(12,6),
    p_provider_cost_usd DECIMAL(12,6),
    p_customer_charge_usd DECIMAL(12,6) DEFAULT 0,
    p_display_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. Row Level Security
-- ============================================================================

-- rate_plans
ALTER TABLE rate_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view rate plans"
ON rate_plans FOR SELECT
TO authenticated
USING (
    project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()
    )
);

CREATE POLICY "Org admins can manage rate plans"
ON rate_plans FOR ALL
TO authenticated
USING (
    project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Service role full access to rate plans"
ON rate_plans FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- end_users
ALTER TABLE end_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view end users"
ON end_users FOR SELECT
TO authenticated
USING (
    project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()
    )
);

CREATE POLICY "Org admins can manage end users"
ON end_users FOR ALL
TO authenticated
USING (
    project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Service role full access to end users"
ON end_users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- end_user_usage
ALTER TABLE end_user_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view end user usage"
ON end_user_usage FOR SELECT
TO authenticated
USING (
    project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()
    )
);

CREATE POLICY "Service role full access to end user usage"
ON end_user_usage FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- stripe_connect_accounts
ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view Stripe Connect accounts"
ON stripe_connect_accounts FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.organization_id = stripe_connect_accounts.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Service role full access to Stripe Connect accounts"
ON stripe_connect_accounts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- end_user_invoices
ALTER TABLE end_user_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view end user invoices"
ON end_user_invoices FOR SELECT
TO authenticated
USING (
    project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()
    )
);

CREATE POLICY "Org admins can manage end user invoices"
ON end_user_invoices FOR ALL
TO authenticated
USING (
    project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    project_id IN (
        SELECT p.id FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Service role full access to end user invoices"
ON end_user_invoices FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 10. Grants
-- ============================================================================

GRANT SELECT ON rate_plans TO authenticated;
GRANT ALL ON rate_plans TO service_role;

GRANT SELECT ON end_users TO authenticated;
GRANT ALL ON end_users TO service_role;

GRANT SELECT ON end_user_usage TO authenticated;
GRANT ALL ON end_user_usage TO service_role;

GRANT SELECT ON stripe_connect_accounts TO authenticated;
GRANT ALL ON stripe_connect_accounts TO service_role;

GRANT SELECT ON end_user_invoices TO authenticated;
GRANT ALL ON end_user_invoices TO service_role;

GRANT EXECUTE ON FUNCTION check_end_user_quota(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_end_user_quota(UUID, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION increment_end_user_usage(UUID, TEXT, BIGINT, BIGINT, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT) TO service_role;

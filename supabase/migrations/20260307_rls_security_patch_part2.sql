-- RLS Security Patch (Part 2)
-- Fixes tables flagged by Supabase Security Advisor.
-- Each table gets RLS enabled + scoped policies based on actual usage.
-- Tables that may not exist are wrapped in existence checks.

-- ============================================================
-- 1. model_pricing — Admin-only (server-side via createAdminClient)
--    Service role bypasses RLS; no client policies needed.
-- ============================================================

ALTER TABLE model_pricing ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. user_mappings — Not referenced in application code.
--    Lock it down; only service role can access.
-- ============================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_mappings') THEN
        ALTER TABLE user_mappings ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================
-- 3. custom_events — Not referenced in application code.
--    Lock it down; only service role can access.
-- ============================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custom_events') THEN
        ALTER TABLE custom_events ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================
-- 4. custom_providers — Server-side via createServerClient.
--    Org members should be able to CRUD their own org's providers.
-- ============================================================

ALTER TABLE custom_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view custom providers" ON custom_providers;
CREATE POLICY "Org members can view custom providers"
    ON custom_providers FOR SELECT
    USING (
        organization_id IN (
            SELECT om.organization_id
            FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Org members can insert custom providers" ON custom_providers;
CREATE POLICY "Org members can insert custom providers"
    ON custom_providers FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id
            FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Org members can update custom providers" ON custom_providers;
CREATE POLICY "Org members can update custom providers"
    ON custom_providers FOR UPDATE
    USING (
        organization_id IN (
            SELECT om.organization_id
            FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Org members can delete custom providers" ON custom_providers;
CREATE POLICY "Org members can delete custom providers"
    ON custom_providers FOR DELETE
    USING (
        organization_id IN (
            SELECT om.organization_id
            FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

-- ============================================================
-- 5. agents — Server-side queries; scoped to project org members.
-- ============================================================

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view agents" ON agents;
CREATE POLICY "Org members can view agents"
    ON agents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = agents.project_id
              AND om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Org members can create agents" ON agents;
CREATE POLICY "Org members can create agents"
    ON agents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = agents.project_id
              AND om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Org members can update agents" ON agents;
CREATE POLICY "Org members can update agents"
    ON agents FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = agents.project_id
              AND om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Org members can delete agents" ON agents;
CREATE POLICY "Org members can delete agents"
    ON agents FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN organization_members om ON om.organization_id = p.organization_id
            WHERE p.id = agents.project_id
              AND om.user_id = auth.uid()
        )
    );

-- ============================================================
-- 6. agent_approvals — Not referenced in application code.
--    Lock it down; only service role can access.
-- ============================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_approvals') THEN
        ALTER TABLE agent_approvals ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================
-- 7. credit_transactions — Client-side reads on billing page.
--    Org members can view their org's transactions.
--    Only service role should insert (server-side billing logic).
-- ============================================================

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view credit transactions" ON credit_transactions;
CREATE POLICY "Org members can view credit transactions"
    ON credit_transactions FOR SELECT
    USING (
        organization_id IN (
            SELECT om.organization_id
            FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

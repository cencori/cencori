-- Forward-only repair for claim_embedded_subagent_run.
--
-- 20260922_000010 is already deployed and must remain immutable. Its
-- unique_violation fallback used IS DISTINCT FROM for four fields while
-- deciding whether an existing run represented the same request. Matching
-- retries require null-safe equality (IS NOT DISTINCT FROM) for every field.
--
-- This migration replaces one function only. It does not alter tables,
-- constraints, rows, or the function's existing public contract.

CREATE OR REPLACE FUNCTION public.claim_embedded_subagent_run(
    p_project_id uuid,
    p_parent_run_id uuid,
    p_child_version_id uuid,
    p_child_installation_id uuid,
    p_input jsonb,
    p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_parent public.embedded_runs%ROWTYPE;
    v_existing public.embedded_runs%ROWTYPE;
    v_child public.agent_versions%ROWTYPE;
    v_installation public.agent_installations%ROWTYPE;
    v_run public.embedded_runs%ROWTYPE;
    v_max_calls integer;
    v_budget_limit numeric;
    v_timeout integer;
    v_count integer;
    v_spent numeric;
    v_input jsonb := COALESCE(p_input, '{}'::jsonb);
BEGIN
    -- FOR UPDATE is the serialization point for all children of this parent.
    SELECT * INTO v_parent FROM public.embedded_runs
    WHERE id = p_parent_run_id AND project_id = p_project_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'parent_run_not_found' USING ERRCODE = 'P0002'; END IF;
    IF v_parent.agent_version_id IS NULL THEN
        RAISE EXCEPTION 'parent_version_missing' USING ERRCODE = 'P0003';
    END IF;

    IF v_parent.tenant_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.platform_tenants
        WHERE id = v_parent.tenant_id AND project_id = p_project_id AND status = 'active'
    ) THEN RAISE EXCEPTION 'tenant_suspended' USING ERRCODE = 'P0003'; END IF;

    -- Idempotent retries do not consume another call. Input equality uses
    -- jsonb structural equality rather than serialization order.
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.embedded_runs
        WHERE project_id = p_project_id AND idempotency_key = p_idempotency_key;
        IF FOUND THEN
            IF v_existing.parent_run_id IS DISTINCT FROM p_parent_run_id
                OR v_existing.tenant_id IS DISTINCT FROM v_parent.tenant_id
                OR v_existing.agent_version_id IS DISTINCT FROM p_child_version_id
                OR v_existing.installation_id IS DISTINCT FROM p_child_installation_id
                OR v_existing.input_ref IS DISTINCT FROM v_input THEN
                RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = 'P0004';
            END IF;
            RETURN jsonb_build_object('id', v_existing.id, 'status', v_existing.status,
                'output', v_existing.output_ref, 'created', false);
        END IF;
    END IF;

    IF v_parent.status NOT IN ('queued', 'running', 'requires_action') THEN
        RAISE EXCEPTION 'parent_run_inactive' USING ERRCODE = 'P0003';
    END IF;

    SELECT max_calls, budget_limit, timeout_ms INTO v_max_calls, v_budget_limit, v_timeout
    FROM public.agent_version_subagents
    WHERE parent_agent_version_id = v_parent.agent_version_id
      AND child_agent_version_id = p_child_version_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'subagent_not_allowed' USING ERRCODE = 'P0003'; END IF;

    SELECT * INTO v_child FROM public.agent_versions
    WHERE id = p_child_version_id AND project_id = p_project_id AND status = 'published';
    IF NOT FOUND THEN RAISE EXCEPTION 'child_version_unavailable' USING ERRCODE = 'P0003'; END IF;

    IF p_child_installation_id IS NOT NULL THEN
        SELECT * INTO v_installation FROM public.agent_installations
        WHERE id = p_child_installation_id AND project_id = p_project_id
          AND agent_id = v_child.agent_id AND status = 'active';
        IF NOT FOUND OR v_installation.tenant_id IS DISTINCT FROM v_parent.tenant_id THEN
            RAISE EXCEPTION 'child_installation_scope_mismatch' USING ERRCODE = 'P0003';
        END IF;
    END IF;

    SELECT count(*) INTO v_count FROM public.embedded_runs
    WHERE parent_run_id = p_parent_run_id AND agent_version_id = p_child_version_id;
    IF v_count >= v_max_calls THEN
        RAISE EXCEPTION 'subagent_call_budget_exhausted' USING ERRCODE = 'P0005';
    END IF;
    IF v_budget_limit IS NOT NULL THEN
        -- Do not admit overlapping unpriced calls against the same edge.
        IF EXISTS (SELECT 1 FROM public.embedded_runs
            WHERE parent_run_id = p_parent_run_id AND agent_version_id = p_child_version_id
              AND status IN ('queued', 'running', 'requires_action')) THEN
            RAISE EXCEPTION 'subagent_budget_busy' USING ERRCODE = 'P0005';
        END IF;
        IF EXISTS (SELECT 1 FROM public.ai_requests r
            JOIN public.embedded_runs child ON child.id = r.run_id
            WHERE child.parent_run_id = p_parent_run_id AND child.agent_version_id = p_child_version_id
              AND r.project_id = p_project_id
              AND r.metadata->>'billing_reconciliation_required' = 'true') THEN
            RAISE EXCEPTION 'subagent_billing_reconciliation_required' USING ERRCODE = 'P0005';
        END IF;
        IF EXISTS (SELECT 1 FROM public.embedded_runs child
            WHERE child.parent_run_id = p_parent_run_id AND child.agent_version_id = p_child_version_id
              AND child.project_id = p_project_id
              AND child.error LIKE 'billing_reconciliation_required:%') THEN
            RAISE EXCEPTION 'subagent_billing_reconciliation_required' USING ERRCODE = 'P0005';
        END IF;
        SELECT COALESCE(sum(COALESCE(r.cencori_charge_usd, 0)), 0) INTO v_spent
        FROM public.ai_requests r JOIN public.embedded_runs child ON child.id = r.run_id
        WHERE child.parent_run_id = p_parent_run_id AND child.agent_version_id = p_child_version_id
          AND r.project_id = p_project_id;
        IF v_spent >= v_budget_limit THEN
            RAISE EXCEPTION 'subagent_spend_budget_exhausted' USING ERRCODE = 'P0005';
        END IF;
    END IF;

    INSERT INTO public.embedded_runs (
        project_id, tenant_id, external_user_id, agent_id, agent_version_id,
        installation_id, session_id, parent_run_id, delegation_depth,
        status, input_ref, idempotency_key
    ) VALUES (
        p_project_id, v_parent.tenant_id, v_parent.external_user_id, v_child.agent_id,
        p_child_version_id, p_child_installation_id, NULL, p_parent_run_id,
        COALESCE(v_parent.delegation_depth, 0) + 1, 'queued', v_input, p_idempotency_key
    ) RETURNING * INTO v_run;
    RETURN jsonb_build_object('id', v_run.id, 'status', v_run.status,
        'output', NULL, 'created', true, 'timeout_ms', v_timeout);
EXCEPTION WHEN unique_violation THEN
    -- A concurrent insert may win the project-scoped idempotency key. Return
    -- it only when every part of the request identity matches null-safely.
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.embedded_runs
        WHERE project_id = p_project_id AND idempotency_key = p_idempotency_key;
        IF FOUND
            AND v_existing.parent_run_id IS NOT DISTINCT FROM p_parent_run_id
            AND v_existing.tenant_id IS NOT DISTINCT FROM v_parent.tenant_id
            AND v_existing.agent_version_id IS NOT DISTINCT FROM p_child_version_id
            AND v_existing.installation_id IS NOT DISTINCT FROM p_child_installation_id
            AND v_existing.input_ref IS NOT DISTINCT FROM v_input THEN
            RETURN jsonb_build_object('id', v_existing.id, 'status', v_existing.status,
                'output', v_existing.output_ref, 'created', false);
        END IF;
    END IF;
    RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = 'P0004';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_embedded_subagent_run(uuid, uuid, uuid, uuid, jsonb, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_embedded_subagent_run(uuid, uuid, uuid, uuid, jsonb, text)
    TO service_role;

-- Serialize each parent's delegations and claim a child run in one transaction.
-- Also pin the published per-edge timeout and spend settings atomically.

-- Repair invalid rows created through the older import path, then make the
-- tenant scope invariant independent of any one API handler. NULL visibility
-- is normalized too: it slips both the old predicates and the CHECK itself.
UPDATE public.skills SET visibility = 'tenant' WHERE tenant_id IS NOT NULL AND (visibility IS NULL OR visibility <> 'tenant');
UPDATE public.skills SET visibility = 'private' WHERE tenant_id IS NULL AND (visibility IS NULL OR visibility = 'tenant');
ALTER TABLE public.skills ADD CONSTRAINT skills_tenant_visibility_check
    CHECK ((tenant_id IS NULL AND visibility <> 'tenant') OR (tenant_id IS NOT NULL AND visibility = 'tenant'));

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

    -- Idempotent retries do not consume another call. Input equality uses jsonb
    -- structural equality rather than serialization order.
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

    SELECT max_calls, budget_limit, timeout_ms INTO v_max_calls, v_budget_limit, v_timeout FROM public.agent_version_subagents
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
    RETURN jsonb_build_object('id', v_run.id, 'status', v_run.status, 'output', NULL, 'created', true, 'timeout_ms', v_timeout);
EXCEPTION WHEN unique_violation THEN
    -- A duplicate project key raced a different parent lock. It is never
    -- treated as a new run or returned without checking its full context.
    -- All comparisons are null-safe: columns the insert always sets still go
    -- through IS DISTINCT FROM so a NULL can never read as a match.
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.embedded_runs
        WHERE project_id = p_project_id AND idempotency_key = p_idempotency_key;
        IF FOUND AND v_existing.parent_run_id IS NOT DISTINCT FROM p_parent_run_id
            AND v_existing.tenant_id IS DISTINCT FROM v_parent.tenant_id
            AND v_existing.agent_version_id IS DISTINCT FROM p_child_version_id
            AND v_existing.installation_id IS DISTINCT FROM p_child_installation_id
            AND v_existing.input_ref IS DISTINCT FROM v_input THEN
            RETURN jsonb_build_object('id', v_existing.id, 'status', v_existing.status,
                'output', v_existing.output_ref, 'created', false);
        END IF;
    END IF;
    RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = 'P0004';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_embedded_subagent_run(uuid, uuid, uuid, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_embedded_subagent_run(uuid, uuid, uuid, uuid, jsonb, text) TO service_role;

CREATE OR REPLACE FUNCTION public.publish_embedded_agent_version(
    p_version_id uuid,
    p_project_id uuid,
    p_reviewed_by text,
    p_set_stable boolean,
    p_skill_version_ids uuid[],
    p_subagents jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row record;
    v_skill_id uuid;
    v_sub jsonb;
    v_child record;
    v_timeout integer;
    v_budget numeric;
BEGIN
    SELECT av.*, a.id AS agent_row_id INTO v_row
    FROM public.agent_versions av JOIN public.agents a ON a.id = av.agent_id
    WHERE av.id = p_version_id AND av.project_id = p_project_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'version_not_found' USING ERRCODE = 'P0002'; END IF;
    IF v_row.status NOT IN ('validating', 'ready_for_review') THEN
        RAISE EXCEPTION 'invalid_status:%', v_row.status USING ERRCODE = 'P0003';
    END IF;
    IF NOT COALESCE(v_row.last_test_passed, false) THEN
        RAISE EXCEPTION 'untested_version' USING ERRCODE = 'P0004';
    END IF;

    DELETE FROM public.agent_version_skills WHERE agent_version_id = p_version_id;
    IF p_skill_version_ids IS NOT NULL THEN
        FOREACH v_skill_id IN ARRAY p_skill_version_ids LOOP
            PERFORM 1 FROM public.skill_versions sv JOIN public.skills s ON s.id = sv.skill_id
            WHERE sv.id = v_skill_id AND sv.project_id = p_project_id
              AND sv.status = 'published' AND s.status <> 'archived';
            IF NOT FOUND THEN RAISE EXCEPTION 'unpublished_skill:%', v_skill_id USING ERRCODE = 'P0005'; END IF;
            INSERT INTO public.agent_version_skills (agent_version_id, skill_version_id)
            VALUES (p_version_id, v_skill_id) ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    DELETE FROM public.agent_version_subagents WHERE parent_agent_version_id = p_version_id;
    IF p_subagents IS NOT NULL THEN
        FOR v_sub IN SELECT * FROM jsonb_array_elements(p_subagents) LOOP
            SELECT sv.id, sv.agent_id, sv.status INTO v_child
            FROM public.agent_versions sv JOIN public.agents a ON a.id = sv.agent_id
            WHERE sv.id = (v_sub->>'agent_version_id')::uuid AND sv.project_id = p_project_id;
            IF NOT FOUND OR v_child.status <> 'published' THEN
                RAISE EXCEPTION 'unpublished_subagent:%', (v_sub->>'agent_version_id') USING ERRCODE = 'P0006';
            END IF;
            IF v_child.agent_id = v_row.agent_id THEN RAISE EXCEPTION 'self_cycle' USING ERRCODE = 'P0007'; END IF;
            v_timeout := (v_sub->>'timeout_ms')::integer;
            v_budget := (v_sub->>'budget_limit')::numeric;
            IF v_timeout IS NOT NULL AND (v_timeout < 1000 OR v_timeout > 600000) THEN
                RAISE EXCEPTION 'invalid_subagent_timeout' USING ERRCODE = 'P0007';
            END IF;
            IF v_budget IS NOT NULL AND v_budget <= 0 THEN
                RAISE EXCEPTION 'invalid_subagent_budget' USING ERRCODE = 'P0007';
            END IF;
            INSERT INTO public.agent_version_subagents (
                parent_agent_version_id, child_agent_version_id, max_calls, timeout_ms, budget_limit
            ) VALUES (
                p_version_id, v_child.id,
                LEAST(25, GREATEST(1, COALESCE((v_sub->>'max_calls')::integer, 1))),
                v_timeout, v_budget
            ) ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    UPDATE public.agent_versions
    SET status = 'published', published_at = now(), reviewed_by = p_reviewed_by, updated_at = now()
    WHERE id = p_version_id;
    IF p_set_stable THEN UPDATE public.agents SET stable_version_id = p_version_id WHERE id = v_row.agent_id; END IF;
    RETURN jsonb_build_object('id', p_version_id, 'version', v_row.version, 'status', 'published');
END;
$$;

REVOKE ALL ON FUNCTION public.publish_embedded_agent_version(uuid, uuid, text, boolean, uuid[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_embedded_agent_version(uuid, uuid, text, boolean, uuid[], jsonb) TO service_role;

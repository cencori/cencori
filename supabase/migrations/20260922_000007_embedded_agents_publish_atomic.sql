-- Atomic agent-version publication with capability pinning + test evidence.
-- Fixes partial publish (status flipped before pins) and untested publish.

ALTER TABLE public.agent_versions
    ADD COLUMN IF NOT EXISTS last_tested_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS last_test_passed boolean NOT NULL DEFAULT false;

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
BEGIN
    SELECT av.*, a.id AS agent_row_id INTO v_row
    FROM public.agent_versions av
    JOIN public.agents a ON a.id = av.agent_id
    WHERE av.id = p_version_id AND av.project_id = p_project_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'version_not_found' USING ERRCODE = 'P0002';
    END IF;
    IF v_row.status NOT IN ('validating', 'ready_for_review') THEN
        RAISE EXCEPTION 'invalid_status:%', v_row.status USING ERRCODE = 'P0003';
    END IF;
    IF NOT COALESCE(v_row.last_test_passed, false) THEN
        RAISE EXCEPTION 'untested_version' USING ERRCODE = 'P0004';
    END IF;

    -- Skill pins: referenced versions must be published (immutable by status).
    DELETE FROM public.agent_version_skills WHERE agent_version_id = p_version_id;
    IF p_skill_version_ids IS NOT NULL THEN
        FOREACH v_skill_id IN ARRAY p_skill_version_ids LOOP
            PERFORM 1 FROM public.skill_versions sv
                JOIN public.skills s ON s.id = sv.skill_id
            WHERE sv.id = v_skill_id AND sv.project_id = p_project_id
              AND sv.status = 'published' AND s.status <> 'archived';
            IF NOT FOUND THEN
                RAISE EXCEPTION 'unpublished_skill:%', v_skill_id USING ERRCODE = 'P0005';
            END IF;
            INSERT INTO public.agent_version_skills (agent_version_id, skill_version_id)
            VALUES (p_version_id, v_skill_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- Subagent edges: children must be published in-project and not self-cycle.
    DELETE FROM public.agent_version_subagents WHERE parent_agent_version_id = p_version_id;
    IF p_subagents IS NOT NULL THEN
        FOR v_sub IN SELECT * FROM jsonb_array_elements(p_subagents) LOOP
            SELECT sv.id, sv.agent_id, sv.status INTO v_child
            FROM public.agent_versions sv
            JOIN public.agents a ON a.id = sv.agent_id
            WHERE sv.id = (v_sub->>'agent_version_id')::uuid AND sv.project_id = p_project_id;
            IF NOT FOUND OR v_child.status <> 'published' THEN
                RAISE EXCEPTION 'unpublished_subagent:%', (v_sub->>'agent_version_id') USING ERRCODE = 'P0006';
            END IF;
            IF v_child.agent_id = v_row.agent_id THEN
                RAISE EXCEPTION 'self_cycle' USING ERRCODE = 'P0007';
            END IF;
            INSERT INTO public.agent_version_subagents (parent_agent_version_id, child_agent_version_id, max_calls)
            VALUES (p_version_id, v_child.id, LEAST(25, GREATEST(1, COALESCE((v_sub->>'max_calls')::int, 1))))
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    UPDATE public.agent_versions
    SET status = 'published', published_at = now(), reviewed_by = p_reviewed_by, updated_at = now()
    WHERE id = p_version_id;

    IF p_set_stable THEN
        UPDATE public.agents SET stable_version_id = p_version_id WHERE id = v_row.agent_id;
    END IF;

    RETURN jsonb_build_object('id', p_version_id, 'version', v_row.version, 'status', 'published');
END;
$$;

REVOKE ALL ON FUNCTION public.publish_embedded_agent_version(uuid, uuid, text, boolean, uuid[], jsonb) FROM PUBLIC;

-- Atomic installation PATCH: row fields + grant swap in one transaction.
--
-- 000002 gave atomic grant replacement, but PATCH also updates the
-- installation row in a separate statement: a row update could commit while
-- the grant swap failed (or vice versa). This replaces the function with a
-- variant that applies an optional row patch and both grant sets in a single
-- transaction (one call = one transaction). NULL array = leave that grant
-- side untouched; empty array = clear it. NULL patch = row untouched.
--
-- The previous 3-argument overload is dropped; all callers pass the patch
-- argument (possibly NULL).

DROP FUNCTION IF EXISTS public.replace_installation_grants(uuid, uuid[], text[]);

CREATE OR REPLACE FUNCTION public.replace_installation_grants(
    p_installation_id uuid,
    p_kb_ids uuid[] DEFAULT NULL,
    p_connection_ids text[] DEFAULT NULL,
    p_row_patch jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_kb uuid[];
    v_conn text[];
BEGIN
    IF p_row_patch IS NOT NULL THEN
        UPDATE public.agent_installations SET
            status = COALESCE((p_row_patch->>'status'), status),
            agent_version_id = COALESCE((p_row_patch->>'agent_version_id')::uuid, agent_version_id),
            update_channel = COALESCE((p_row_patch->>'update_channel'), update_channel),
            overlay_config = COALESCE(p_row_patch->'overlay_config', overlay_config),
            approval_policy = COALESCE(p_row_patch->'approval_policy', approval_policy),
            budget = COALESCE(p_row_patch->'budget', budget)
        WHERE id = p_installation_id;
    END IF;

    IF p_kb_ids IS NOT NULL THEN
        DELETE FROM public.installation_knowledge_bases
        WHERE installation_id = p_installation_id;
        IF array_length(p_kb_ids, 1) > 0 THEN
            INSERT INTO public.installation_knowledge_bases (installation_id, knowledge_base_id)
            SELECT p_installation_id, unnest(p_kb_ids)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    IF p_connection_ids IS NOT NULL THEN
        DELETE FROM public.installation_connections
        WHERE installation_id = p_installation_id;
        IF array_length(p_connection_ids, 1) > 0 THEN
            INSERT INTO public.installation_connections (installation_id, connection_id)
            SELECT p_installation_id, unnest(p_connection_ids)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT COALESCE(array_agg(knowledge_base_id), '{}') INTO v_kb
    FROM public.installation_knowledge_bases
    WHERE installation_id = p_installation_id;
    SELECT COALESCE(array_agg(connection_id), '{}') INTO v_conn
    FROM public.installation_connections
    WHERE installation_id = p_installation_id;

    RETURN jsonb_build_object('knowledge_base_ids', v_kb, 'connection_ids', v_conn);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_installation_grants(uuid, uuid[], text[], jsonb)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_installation_grants(uuid, uuid[], text[], jsonb)
    TO service_role;

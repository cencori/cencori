-- Atomic installation grant replacement.
--
-- PATCH replacement previously ran DELETE + row-by-row INSERTs from
-- application code: a crash or a failed write mid-sequence left grants
-- half-replaced with no error surfaced. This function swaps one or both
-- grant sets in a single transaction (one call = one transaction).
--
-- NULL array = leave that side untouched; empty array = clear it.
-- Returns the effective grant sets after the swap.

CREATE OR REPLACE FUNCTION public.replace_installation_grants(
    p_installation_id uuid,
    p_kb_ids uuid[] DEFAULT NULL,
    p_connection_ids text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_kb uuid[];
    v_conn text[];
BEGIN
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

REVOKE ALL ON FUNCTION public.replace_installation_grants(uuid, uuid[], text[])
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_installation_grants(uuid, uuid[], text[])
    TO service_role;

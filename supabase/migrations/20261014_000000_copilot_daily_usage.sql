-- Copilot fair-use cap: questions per organization per UTC day.
--
-- Copilot is free to use but capped by plan (Free 10/day; higher on paid
-- tiers — the limits live in app/api/agent/route.ts). One row per subject per
-- day; subject is 'org:<uuid>', or 'user:<uuid>' when no organization is in
-- context, so leaving the org out can't bypass the cap.
--
-- copilot_consume() checks and increments in one statement, so concurrent
-- requests can't both slip under the limit. Service role only: the agent
-- route calls it after verifying the user's access.

CREATE TABLE IF NOT EXISTS public.copilot_daily_usage (
    subject   text NOT NULL,
    day       date NOT NULL,
    questions integer NOT NULL DEFAULT 0,
    PRIMARY KEY (subject, day)
);

ALTER TABLE public.copilot_daily_usage ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) reads or writes it.

-- Consume one question if the subject is under p_limit today (UTC).
-- Returns { allowed, used, limit }. p_limit <= 0 means unlimited.
CREATE OR REPLACE FUNCTION public.copilot_consume(p_subject text, p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_day  date := (now() AT TIME ZONE 'utc')::date;
    v_used integer;
BEGIN
    INSERT INTO public.copilot_daily_usage AS u (subject, day, questions)
    VALUES (p_subject, v_day, 1)
    ON CONFLICT (subject, day) DO UPDATE
        SET questions = u.questions + 1
        WHERE p_limit <= 0 OR u.questions < p_limit
    RETURNING questions INTO v_used;

    IF v_used IS NULL THEN
        -- At the cap: the conditional update matched nothing.
        SELECT questions INTO v_used FROM public.copilot_daily_usage
        WHERE subject = p_subject AND day = v_day;
        RETURN jsonb_build_object('allowed', false, 'used', v_used, 'limit', p_limit);
    END IF;

    RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', p_limit);
END;
$$;

REVOKE ALL ON FUNCTION public.copilot_consume(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copilot_consume(text, integer) TO service_role;

-- Session billing: track cumulative cost per session

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS total_cost_usd numeric(12,6) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_session_cost(session_id uuid, cost numeric)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.sessions
    SET total_cost_usd = COALESCE(total_cost_usd, 0) + cost
    WHERE id = session_id;
END;
$$;

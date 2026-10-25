-- Copilot usage, one row per answered question, for billing and Copilot → Usage.
--
-- Pricing keeps Copilot's existing shape: each plan gets free questions per UTC
-- day (copilot_daily_usage / copilot_consume, unchanged). Past that, a question
-- is billed to the organization's credits at the model's inference cost plus a
-- flat $0.25 per million tokens. Free questions are recorded here too (billed =
-- false) so the usage page can show what each conversation would have cost.
--
-- Written by the service role only (the agent route); read by the usage API,
-- which checks organization membership first.

CREATE TABLE IF NOT EXISTS public.copilot_usage_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL,
    -- The copilot_conversations row this answer belongs to. Not a foreign key:
    -- the client saves the conversation after the answer, and deleting a
    -- conversation must not erase what was billed for it.
    conversation_id uuid,
    input_tokens    integer NOT NULL DEFAULT 0,
    output_tokens   integer NOT NULL DEFAULT 0,
    -- Inference cost as reported by the gateway, before the flat token rate.
    model_cost_usd  numeric(12, 6) NOT NULL DEFAULT 0,
    -- model_cost_usd + tokens × the flat rate: what the question costs.
    cost_usd        numeric(12, 6) NOT NULL DEFAULT 0,
    -- True when cost_usd was deducted from credits; false inside the free allowance.
    billed          boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_usage_events_org_created
    ON public.copilot_usage_events (organization_id, created_at DESC);

ALTER TABLE public.copilot_usage_events ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) reads or writes it.

-- Schema Cleanup (Minor Audit Items)

-- #11: Drop unused user_keys table
DROP TABLE IF EXISTS public.user_keys;

-- #13: Remove model column from agents table (canonical source is agent_configs.model)
ALTER TABLE public.agents DROP COLUMN IF EXISTS model;

-- #14: Add updated_at trigger for agent_configs
ALTER TABLE public.agent_configs
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION update_agent_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_agent_configs_updated_at ON public.agent_configs;
CREATE TRIGGER set_agent_configs_updated_at
    BEFORE UPDATE ON public.agent_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_configs_updated_at();

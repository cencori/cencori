-- Add tools column to agent_configs for built-in tool selection
ALTER TABLE public.agent_configs
    ADD COLUMN IF NOT EXISTS tools jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Update RLS to allow tools column (existing policies already cover all columns)

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  blueprint TEXT NOT NULL, -- 'openclaw', 'openmanus', 'autogpt', 'custom'
  is_active BOOLEAN DEFAULT true,
  shadow_mode BOOLEAN DEFAULT true,
  system_prompt TEXT,
  model TEXT,
  tools JSONB DEFAULT '[]'::jsonb,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Associate agents with API keys
ALTER TABLE api_keys ADD COLUMN agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;

-- Create agent_approvals table for Shadow Mode
CREATE TABLE IF NOT EXISTS agent_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  tool_params JSONB,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  risk_score FLOAT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES auth.users(id)
);

-- Add indexes
CREATE INDEX idx_agents_project ON agents(project_id);
CREATE INDEX idx_approvals_agent_status ON agent_approvals(agent_id, status);
CREATE INDEX idx_api_keys_agent ON api_keys(agent_id);

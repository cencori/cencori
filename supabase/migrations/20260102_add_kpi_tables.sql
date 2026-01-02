-- KPI Role Pages: Tables for role-based KPI submissions
-- Run this in Supabase SQL Editor

-- Table: kpi_roles - Define available roles and their metrics
CREATE TABLE IF NOT EXISTS kpi_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_email TEXT,
  metrics JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: kpi_entries - Store submitted KPI values
CREATE TABLE IF NOT EXISTS kpi_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id TEXT REFERENCES kpi_roles(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  period_month DATE NOT NULL,
  submitted_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one entry per metric per month per role
CREATE UNIQUE INDEX IF NOT EXISTS kpi_entries_unique 
ON kpi_entries(role_id, metric_key, period_month);

-- Enable RLS
ALTER TABLE kpi_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated @cencori.com users to read/write
CREATE POLICY "Cencori team can read roles" ON kpi_roles
  FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' LIKE '%@cencori.com');

CREATE POLICY "Cencori team can read entries" ON kpi_entries
  FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' LIKE '%@cencori.com');

CREATE POLICY "Cencori team can insert entries" ON kpi_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' LIKE '%@cencori.com');

CREATE POLICY "Cencori team can update entries" ON kpi_entries
  FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'email' LIKE '%@cencori.com');

-- Seed initial roles
INSERT INTO kpi_roles (id, name, owner_email, metrics) VALUES
  ('growth', 'Growth + Product', NULL, '[
    {"key": "content_published", "label": "Content Published", "target": 4, "unit": "pieces"},
    {"key": "signups_notes", "label": "Signup Progress Notes", "target": null, "type": "text"}
  ]'::jsonb),
  ('engineering', 'Ops + Engineering', NULL, '[
    {"key": "critical_bugs", "label": "Critical Bugs", "target": 0, "unit": "open"},
    {"key": "features_shipped", "label": "Features Shipped", "target": 2, "unit": "this month"},
    {"key": "uptime_notes", "label": "Uptime Notes", "target": null, "type": "text"},
    {"key": "latency_notes", "label": "Latency Notes", "target": null, "type": "text"}
  ]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Migration: Create model_mappings table for cross-provider failover mappings
-- Replaces hardcoded MODEL_MAPPINGS in lib/providers/failover.ts

CREATE TABLE IF NOT EXISTS model_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_model TEXT NOT NULL,
    target_provider TEXT NOT NULL,
    target_model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(source_model, target_provider)
);

CREATE INDEX IF NOT EXISTS idx_model_mappings_source ON model_mappings(source_model);
CREATE INDEX IF NOT EXISTS idx_model_mappings_provider ON model_mappings(target_provider);

-- Enable RLS
ALTER TABLE model_mappings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read mappings (they're platform-wide)
CREATE POLICY "Authenticated users can read model_mappings"
ON model_mappings FOR SELECT
TO authenticated
USING (true);

-- Only cencori admins can insert
CREATE POLICY "Admins can insert model_mappings"
ON model_mappings FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM cencori_admins ca
        WHERE ca.user_id = auth.uid()
        AND ca.status = 'active'
    )
);

-- Only cencori admins can update
CREATE POLICY "Admins can update model_mappings"
ON model_mappings FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM cencori_admins ca
        WHERE ca.user_id = auth.uid()
        AND ca.status = 'active'
    )
);

-- Only cencori admins can delete
CREATE POLICY "Admins can delete model_mappings"
ON model_mappings FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM cencori_admins ca
        WHERE ca.user_id = auth.uid()
        AND ca.status = 'active'
    )
);

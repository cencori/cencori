-- RLS Security Patch (Part 3)
-- Fixes: custom_models — child table of custom_providers, needs org-scoped access.

ALTER TABLE custom_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view custom models" ON custom_models;
CREATE POLICY "Org members can view custom models"
    ON custom_models FOR SELECT
    USING (
        provider_id IN (
            SELECT cp.id
            FROM custom_providers cp
            JOIN organization_members om ON om.organization_id = cp.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Org members can insert custom models" ON custom_models;
CREATE POLICY "Org members can insert custom models"
    ON custom_models FOR INSERT
    WITH CHECK (
        provider_id IN (
            SELECT cp.id
            FROM custom_providers cp
            JOIN organization_members om ON om.organization_id = cp.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Org members can update custom models" ON custom_models;
CREATE POLICY "Org members can update custom models"
    ON custom_models FOR UPDATE
    USING (
        provider_id IN (
            SELECT cp.id
            FROM custom_providers cp
            JOIN organization_members om ON om.organization_id = cp.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Org members can delete custom models" ON custom_models;
CREATE POLICY "Org members can delete custom models"
    ON custom_models FOR DELETE
    USING (
        provider_id IN (
            SELECT cp.id
            FROM custom_providers cp
            JOIN organization_members om ON om.organization_id = cp.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

-- Add index on edge_integrations metadata->>'configurationId' for efficient lookup
-- without this, listEdgeIntegrationRecordsByProviderAndConfigurationId scans all rows
create index if not exists idx_edge_integrations_configuration_id
    on public.edge_integrations ((metadata->>'configurationId'))
    where metadata->>'configurationId' is not null;

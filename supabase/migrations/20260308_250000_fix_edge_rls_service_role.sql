-- Fix: scope all edge integration service-role policies to auth.role() = 'service_role'
-- Previously these used 'using (true) / with check (true)' which granted all roles full access.

-- edge_integrations
drop policy if exists "Service role can manage edge integrations" on public.edge_integrations;
create policy "Service role can manage edge integrations"
    on public.edge_integrations
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- edge_integration_domains
drop policy if exists "Service role can manage edge domains" on public.edge_integration_domains;
create policy "Service role can manage edge domains"
    on public.edge_integration_domains
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- edge_deployments
drop policy if exists "Service role can manage edge deployments" on public.edge_deployments;
create policy "Service role can manage edge deployments"
    on public.edge_deployments
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- edge_integration_credentials
drop policy if exists "Service role can manage edge integration credentials" on public.edge_integration_credentials;
create policy "Service role can manage edge integration credentials"
    on public.edge_integration_credentials
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- web_request_logs (pre-existing table, same overly-broad pattern)
drop policy if exists "Service role can insert web logs" on public.web_request_logs;
create policy "Service role can insert web logs"
    on public.web_request_logs
    for insert
    with check (auth.role() = 'service_role');

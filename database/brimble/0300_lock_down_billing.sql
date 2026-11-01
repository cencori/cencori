-- Browser roles (anon, authenticated) reach the database through PostgREST
-- (/api/data/rest), so anything they're granted, anyone on the internet can
-- call. Found 2026-10-31:
--
-- 1. Every SECURITY DEFINER function in public was executable by anon. They
--    run with the owner's rights and check nothing about the caller, e.g.
--    deduct_organization_credits with a negative amount added credits to any
--    organization, and basecode_grant_pass handed out paid passes. The app
--    calls them only with the service role, so they become server-only.
-- 2. Org owners could UPDATE their own organizations row, any column:
--    credits_balance, subscription_tier, billing_frozen, business_plan...
--    Browser roles now hold column-level INSERT/UPDATE on the columns the
--    app writes through user clients (name, slug, billing contact and
--    address, SSO settings) and nothing else.
-- 3. Key owners could set api_keys.sponsored_models, which makes usage free.
-- 4. Users could insert or update their own scan_subscriptions row (paid
--    Scan tiers). Only Cencori's billing code writes it, as the service role.
--
-- Idempotent: runs before every deploy, so functions added later are locked
-- too. Only GRANT/REVOKE here: unlike CREATE TRIGGER or DROP POLICY they
-- don't wait for open transactions on these hot tables (a long-open one
-- blocked the trigger version of this file on 2026-11-01).

-- 1. SECURITY DEFINER functions: server only.
do $$
declare
    f regprocedure;
begin
    for f in
        select p.oid::regprocedure
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef
    loop
        execute format('revoke execute on function %s from public, anon, authenticated', f);
        execute format('grant execute on function %s to service_role', f);
    end loop;
end
$$;

-- 2. organizations: browser roles write only the columns the app sends
--    through user clients. Billing, plan, credit and freeze columns are
--    written by Cencori's server code as the service role.
revoke insert, update on public.organizations from anon, authenticated;
grant insert (name, slug, description, owner_id, billing_email)
    on public.organizations to authenticated;
grant update (name, slug, description, billing_email,
              billing_address_line1, billing_address_line2, billing_city,
              billing_state, billing_zip, billing_country, billing_tax_id,
              sso_enabled, sso_provider_id, sso_domain, sso_enforce,
              sso_configured_at, sso_configured_by)
    on public.organizations to authenticated;

-- 3. api_keys: every column except sponsored_models, which Cencori grants.
do $$
declare
    cols text;
begin
    select string_agg(quote_ident(column_name), ', ')
    into cols
    from information_schema.columns
    where table_schema = 'public' and table_name = 'api_keys' and column_name <> 'sponsored_models';

    revoke insert, update on public.api_keys from anon, authenticated;
    execute format('grant insert (%s), update (%s) on public.api_keys to authenticated', cols, cols);
end
$$;

-- 4. scan_subscriptions: written by billing code only.
revoke insert, update, delete on public.scan_subscriptions from anon, authenticated;

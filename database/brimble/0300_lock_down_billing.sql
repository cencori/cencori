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
--    A trigger now rejects browser-role changes to billing columns, and
--    browser-role inserts get the defaults for them.
-- 3. Key owners could set api_keys.sponsored_models, which makes usage free.
-- 4. Users could insert or update their own scan_subscriptions row (paid
--    Scan tiers). Only Cencori's billing code writes it, as the service role.
--
-- Idempotent: runs before every deploy, so functions added later are locked
-- too. Table DDL only runs when something is missing, so a deploy never
-- queues for a lock on these hot tables once this has applied.

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

-- 2. organizations: billing columns belong to Cencori.
create or replace function public.protect_organization_billing()
returns trigger
language plpgsql
as $$
begin
    if current_user not in ('anon', 'authenticated') then
        return new;
    end if;

    if tg_op = 'INSERT' then
        new.plan_id := null;
        new.subscription_tier := 'free';
        new.subscription_status := 'active';
        new.subscription_id := null;
        new.polar_customer_id := null;
        new.subscription_current_period_start := null;
        new.subscription_current_period_end := null;
        new.monthly_request_limit := 1000;
        new.monthly_requests_used := 0;
        new.usage_reset_at := now() + interval '1 month';
        new.credits_balance := 0;
        new.credits_updated_at := now();
        new.billing_frozen := false;
        new.billing_freeze_reason := null;
        new.billing_frozen_at := null;
        new.billing_frozen_by := null;
        new.bachs_customer_id := null;
        new.stripe_customer_id := null;
        new.billing_provider := null;
        new.account_type := 'developer';
        new.business_plan := null;
        new.business_plan_status := null;
        new.business_subscription_id := null;
        new.business_period_start := null;
        new.business_period_end := null;
        return new;
    end if;

    if (new.plan_id, new.subscription_tier, new.subscription_status, new.subscription_id,
        new.polar_customer_id, new.subscription_current_period_start, new.subscription_current_period_end,
        new.monthly_request_limit, new.monthly_requests_used, new.usage_reset_at,
        new.credits_balance, new.credits_updated_at,
        new.billing_frozen, new.billing_freeze_reason, new.billing_frozen_at, new.billing_frozen_by,
        new.bachs_customer_id, new.stripe_customer_id, new.billing_provider,
        new.account_type, new.business_plan, new.business_plan_status, new.business_subscription_id,
        new.business_period_start, new.business_period_end)
       is distinct from
       (old.plan_id, old.subscription_tier, old.subscription_status, old.subscription_id,
        old.polar_customer_id, old.subscription_current_period_start, old.subscription_current_period_end,
        old.monthly_request_limit, old.monthly_requests_used, old.usage_reset_at,
        old.credits_balance, old.credits_updated_at,
        old.billing_frozen, old.billing_freeze_reason, old.billing_frozen_at, old.billing_frozen_by,
        old.bachs_customer_id, old.stripe_customer_id, old.billing_provider,
        old.account_type, old.business_plan, old.business_plan_status, old.business_subscription_id,
        old.business_period_start, old.business_period_end)
    then
        raise exception 'Billing fields are managed by Cencori' using errcode = '42501';
    end if;
    return new;
end
$$;

-- Created once; later deploys only replace the function, which takes no
-- lock on the table.
do $$
begin
    if not exists (
        select 1 from pg_trigger
        where tgname = 'protect_organization_billing' and tgrelid = 'public.organizations'::regclass
    ) then
        create trigger protect_organization_billing
            before insert or update on public.organizations
            for each row execute function public.protect_organization_billing();
    end if;
end
$$;

-- 3. api_keys: sponsorship is granted by Cencori, never by the key's owner.
create or replace function public.protect_api_key_sponsorship()
returns trigger
language plpgsql
as $$
begin
    if current_user not in ('anon', 'authenticated') then
        return new;
    end if;
    if tg_op = 'INSERT' then
        new.sponsored_models := null;
    elsif new.sponsored_models is distinct from old.sponsored_models then
        raise exception 'Sponsored models are managed by Cencori' using errcode = '42501';
    end if;
    return new;
end
$$;

-- Created once; later deploys only replace the function, which takes no
-- lock on the table.
do $$
begin
    if not exists (
        select 1 from pg_trigger
        where tgname = 'protect_api_key_sponsorship' and tgrelid = 'public.api_keys'::regclass
    ) then
        create trigger protect_api_key_sponsorship
            before insert or update on public.api_keys
            for each row execute function public.protect_api_key_sponsorship();
    end if;
end
$$;

-- 4. scan_subscriptions: written by billing code only.
do $$
begin
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scan_subscriptions'
               and policyname = 'Users can insert own scan subscriptions') then
        drop policy "Users can insert own scan subscriptions" on public.scan_subscriptions;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scan_subscriptions'
               and policyname = 'Users can update own scan subscriptions') then
        drop policy "Users can update own scan subscriptions" on public.scan_subscriptions;
    end if;
end
$$;

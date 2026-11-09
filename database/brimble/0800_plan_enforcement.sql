-- Plan enforcement in the database (2026-11-09), so the browser can't skip it:
--
-- 1. Free plan: 1 project per organization. Projects are inserted from the
--    browser in several places; this trigger runs on every insert, whoever
--    makes it. Existing projects are untouched (grandfathered).
-- 2. One Free organization per person: a developer org created by someone
--    who already owns a Free developer org is marked requires_pro, and stays
--    paused until it's on a paid plan (lib/billing/plan-state.ts). Paying for
--    Pro clears it (the check is "requires_pro AND still free"). Existing
--    orgs are untouched; business accounts have their own limit.
--
-- Runs before every deploy (scripts/brimble-apply-sql.mjs), so it is
-- idempotent and, after the first run, takes no lock on the hot tables:
-- the column and triggers are only created when missing (CREATE TRIGGER and
-- ALTER TABLE wait on open transactions; see 0300_lock_down_billing.sql).
-- Function bodies are replaced every run, which locks nothing.
--
-- requires_pro needs no grant: browser roles hold column-level INSERT/UPDATE
-- on named columns only (0300), so they can't set or clear it.

-- requires_pro on organizations (only when missing).
do $$
begin
    if not exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'organizations' and column_name = 'requires_pro'
    ) then
        alter table public.organizations add column requires_pro boolean not null default false;
    end if;
end
$$;

-- One Free organization per person.
create or replace function public.mark_extra_free_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if coalesce(new.account_type, 'developer') = 'business' then
        return new;
    end if;
    if coalesce(new.subscription_tier, 'free') <> 'free' or new.owner_id is null then
        return new;
    end if;

    -- One person at a time, so two simultaneous creates can't both be "first".
    perform pg_advisory_xact_lock(hashtext('one_free_org:' || new.owner_id::text));

    if exists (
        select 1 from organizations
         where owner_id = new.owner_id
           and coalesce(account_type, 'developer') <> 'business'
           and coalesce(subscription_tier, 'free') = 'free'
           and requires_pro = false
    ) then
        new.requires_pro := true;
    end if;
    return new;
end;
$$;

-- Projects: 1 on Free; none in an org that needs Pro.
create or replace function public.enforce_project_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    org_tier text;
    org_account_type text;
    org_requires_pro boolean;
    existing integer;
begin
    select coalesce(subscription_tier, 'free'), coalesce(account_type, 'developer'), coalesce(requires_pro, false)
      into org_tier, org_account_type, org_requires_pro
      from organizations
     where id = new.organization_id;

    if org_tier <> 'free' or org_account_type = 'business' then
        return new;
    end if;

    if org_requires_pro then
        raise exception 'pro_required: This organization needs Pro. Your first organization is free; others are on Pro.'
            using errcode = 'P0001';
    end if;

    -- One org at a time, so two simultaneous creates can't both see 0.
    perform pg_advisory_xact_lock(hashtext('project_plan_limit:' || new.organization_id::text));

    select count(*) into existing from projects where organization_id = new.organization_id;
    if existing >= 1 then
        raise exception 'project_limit_reached: The Free plan includes 1 project. Upgrade to Pro for unlimited projects.'
            using errcode = 'P0001';
    end if;

    return new;
end;
$$;

-- The triggers (only when missing).
do $$
begin
    if not exists (select 1 from pg_trigger where tgname = 'mark_extra_free_organization' and tgrelid = 'public.organizations'::regclass) then
        create trigger mark_extra_free_organization
            before insert on public.organizations
            for each row
            execute function public.mark_extra_free_organization();
    end if;
    if not exists (select 1 from pg_trigger where tgname = 'enforce_project_plan_limit' and tgrelid = 'public.projects'::regclass) then
        create trigger enforce_project_plan_limit
            before insert on public.projects
            for each row
            execute function public.enforce_project_plan_limit();
    end if;
end
$$;

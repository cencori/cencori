-- Business plans: a second plan track for organizations that build agents
-- for their own business (restaurants, shops) rather than with the API.
-- They pay a flat monthly naira price for a number of conversations instead
-- of buying credits, so the developer tier (subscription_tier) and credits
-- are left untouched and these columns sit beside them.
alter table public.organizations
    add column if not exists account_type text not null default 'developer',
    add column if not exists business_plan text,
    add column if not exists business_plan_status text,
    add column if not exists business_subscription_id text,
    add column if not exists business_period_start timestamptz,
    add column if not exists business_period_end timestamptz;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'organizations_account_type_check') then
        alter table public.organizations add constraint organizations_account_type_check
            check (account_type in ('developer', 'business'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'organizations_business_plan_check') then
        alter table public.organizations add constraint organizations_business_plan_check
            check (business_plan is null or business_plan in ('trial', 'starter', 'growth', 'business'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'organizations_business_plan_status_check') then
        alter table public.organizations add constraint organizations_business_plan_status_check
            check (business_plan_status is null or business_plan_status in ('active', 'past_due', 'canceled'));
    end if;
end $$;

-- Conversations started in each billing period, per organization.
create table if not exists public.business_usage (
    organization_id uuid not null references public.organizations(id) on delete cascade,
    period_start timestamptz not null,
    conversations integer not null default 0 check (conversations >= 0),
    updated_at timestamptz not null default now(),
    primary key (organization_id, period_start)
);

-- Server-only: every read and write goes through the service role.
alter table public.business_usage enable row level security;

-- Count one new conversation if the period still has room. Returns the new
-- count, or -1 when the plan's conversations are used up. One statement, so
-- two conversations starting at once can't both take the last slot.
create or replace function public.consume_business_conversation(
    p_organization_id uuid,
    p_period_start timestamptz,
    p_limit integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count integer;
begin
    insert into public.business_usage (organization_id, period_start, conversations)
    values (p_organization_id, p_period_start, 0)
    on conflict (organization_id, period_start) do nothing;

    update public.business_usage
       set conversations = conversations + 1, updated_at = now()
     where organization_id = p_organization_id
       and period_start = p_period_start
       and conversations < p_limit
    returning conversations into v_count;

    return coalesce(v_count, -1);
end;
$$;

revoke all on function public.consume_business_conversation(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_business_conversation(uuid, timestamptz, integer) to service_role;

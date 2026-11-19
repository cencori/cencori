-- Credits: usage topped up on a paid plan (2026-11-19).
--
-- Any amount, within limits, at a fixed rate per plan: half as much again as the plan itself
-- charges for the same usage (lib/tensor-refills.ts), so every top-up earns above what it lets
-- through. Credits never expire. They are spent only once a period's own share is gone: each
-- period's ceiling is its share plus the balance, which is every top-up less what earlier periods
-- spent past their own shares.

create table if not exists public.tensor_refills (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.basecode_billing_accounts(id) on delete restrict,
  -- The plan the refill was bought on, which priced it.
  plan_code text not null references public.basecode_plans(code),
  provider text not null default 'bachs' check (provider = 'bachs'),
  reference text not null unique,
  provider_checkout_id text unique,
  provider_transaction_id text unique,
  expected_amount_minor bigint not null check (expected_amount_minor > 0),
  currency text not null check (currency in ('NGN', 'USD')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  -- The usage it buys, at the plan's refill rate, set again from what was actually paid.
  credit_microusd bigint not null check (credit_microusd > 0),
  paid_amount_minor bigint,
  paid_currency text check (paid_currency is null or paid_currency in ('NGN', 'USD')),
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tensor_refills_account_idx on public.tensor_refills (account_id, created_at desc);

alter table public.tensor_refills enable row level security;
revoke all on table public.tensor_refills from anon, authenticated;
grant all on table public.tensor_refills to service_role;

-- Applies a verified payment to its refill, once. The amount and the usage it buys have been
-- worked out from the payment by the caller (lib/tensor-refills.ts); a second delivery of the
-- same payment is a no-op.
create or replace function public.tensor_apply_refill(
  p_refill_id uuid,
  p_transaction_id text,
  p_amount_minor bigint,
  p_currency text,
  p_credit_microusd bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refill public.tensor_refills%rowtype;
begin
  if p_credit_microusd is null or p_credit_microusd <= 0 then
    raise exception 'tensor_refill_credit';
  end if;
  select * into v_refill from public.tensor_refills where id = p_refill_id for update;
  if not found then
    raise exception 'tensor_refill_missing';
  end if;
  if v_refill.status = 'paid' then
    return jsonb_build_object('applied', false, 'already', true, 'refill_id', v_refill.id);
  end if;

  update public.tensor_refills
  set status = 'paid',
      paid_at = now(),
      provider_transaction_id = p_transaction_id,
      paid_amount_minor = p_amount_minor,
      paid_currency = p_currency,
      credit_microusd = p_credit_microusd
  where id = v_refill.id;

  return jsonb_build_object('applied', true, 'refill_id', v_refill.id, 'credit_microusd', p_credit_microusd);
end;
$$;

revoke all on function public.tensor_apply_refill(uuid, text, bigint, text, bigint) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.tensor_apply_refill(uuid, text, bigint, text, bigint) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.tensor_apply_refill(uuid, text, bigint, text, bigint) to service_role;
  end if;
end $$;

-- What is left of an account's top-ups as a period starts: every paid one, less what the periods
-- before it spent past their own share of their plan (a week's share of the month, or the
-- trial's whole month). Periods from before the first top-up are not counted against it.
create or replace function public.tensor_credit_balance(p_account_id uuid, p_before timestamptz)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  with bought as (
    select coalesce(sum(credit_microusd), 0)::bigint as total, min(paid_at) as first_paid
    from public.tensor_refills
    where account_id = p_account_id and status = 'paid'
  ),
  spent as (
    select coalesce(sum(greatest(
      greatest(p.cost_used_microusd - p.cost_reset_microusd, 0)
        - round(coalesce(pl.pass_budget_microusd, 0) * extract(epoch from (p.ends_at - p.starts_at))
                / (86400.0 * greatest(pl.billing_period_days, 1)))::bigint,
      0
    )), 0)::bigint as total
    from public.basecode_usage_periods p
    join public.basecode_plans pl on pl.code = p.plan_code
    cross join bought b
    where p.account_id = p_account_id
      and b.first_paid is not null
      and p.ends_at > b.first_paid
      and p.starts_at < p_before
  )
  select greatest((select total from bought) - (select total from spent), 0)::bigint;
$$;

revoke all on function public.tensor_credit_balance(uuid, timestamptz) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.tensor_credit_balance(uuid, timestamptz) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.tensor_credit_balance(uuid, timestamptz) to service_role;
  end if;
end $$;

-- ── The allowance an account is in ───────────────────────────────────────
-- As in 2900, with the credit balance added to the period (above).
create or replace function public.basecode_allowance_period(
  p_account_id uuid,
  p_at timestamptz default now()
)
returns table (
  plan_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  -- Always null. Kept so callers written against the task count read "no limit".
  task_limit integer,
  pass_ends_at timestamptz,
  pass_cost_used_microusd bigint,
  model_policy text,
  -- What this period may cost, and what it has, less anything a reset forgave.
  budget_microusd bigint,
  cost_used_microusd bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_account public.basecode_billing_accounts%rowtype;
  v_plan public.basecode_plans%rowtype;
  v_legacy public.basecode_usage_periods%rowtype;
  v_paid_from timestamptz;
  v_paid_until timestamptz;
  v_month_starts_at timestamptz;
  v_month_seconds numeric;
  v_months integer;
  v_month integer;
  v_weeks integer;
  v_last_week integer;
  v_starts_at timestamptz;
begin
  select * into v_account from public.basecode_billing_accounts where id = p_account_id;
  if not found then
    raise exception 'basecode_account_missing';
  end if;

  select * into v_plan
  from public.basecode_plans
  where code = public.basecode_effective_plan(v_account) and enabled;
  if not found then
    raise exception 'basecode_plan_unavailable';
  end if;

  plan_code := v_plan.code;
  task_limit := null;
  model_policy := v_plan.model_policy;
  budget_microusd := v_plan.pass_budget_microusd;

  if v_plan.code = 'free' then
    -- The trial's month is one period, with the whole of its ceiling.
    select t.starts_at, t.ends_at into starts_at, ends_at
    from public.basecode_trial_period(v_account.created_at, p_at) t;
    v_month_starts_at := starts_at;
    pass_ends_at := ends_at;
  else
    if v_account.model_policy_override is not null
      and (v_account.model_policy_override_until is null or p_at < v_account.model_policy_override_until) then
      model_policy := v_account.model_policy_override;
    end if;
    v_paid_from := coalesce(v_account.entitlement_starts_at, v_account.created_at);
    v_paid_until := v_account.entitlement_ends_at;

    -- The paid month this moment falls in. What is paid for is a whole number of
    -- months, counted from the first; anything left over belongs to the last one, so
    -- a 31-day month is one month and not a month and a day.
    v_months := case
      when v_paid_until is null then 1
      else greatest(
        1,
        floor(extract(epoch from (v_paid_until - v_paid_from)) / (86400.0 * v_plan.billing_period_days))::integer
      )
    end;
    v_month := least(
      v_months - 1,
      greatest(
        0,
        floor(extract(epoch from (p_at - v_paid_from)) / (86400.0 * v_plan.billing_period_days))::integer
      )
    );
    v_month_starts_at := v_paid_from + make_interval(days => v_plan.billing_period_days * v_month);
    pass_ends_at := case
      when v_month = v_months - 1 then v_paid_until
      else v_month_starts_at + make_interval(days => v_plan.billing_period_days)
    end;

    -- A pass bought before weeks existed has one period as long as the pass.
    select * into v_legacy
    from public.basecode_usage_periods p
    where p.account_id = v_account.id
      and p.plan_code = v_plan.code
      and p.starts_at = v_paid_from
      and p.ends_at > v_paid_from + interval '13 days';

    if found and v_month = 0 then
      starts_at := v_paid_from;
      ends_at := pass_ends_at;
    else
      v_month_seconds := extract(epoch from (
        coalesce(pass_ends_at, v_month_starts_at + make_interval(days => v_plan.billing_period_days))
        - v_month_starts_at
      ));
      v_weeks := greatest(
        0,
        floor(extract(epoch from (p_at - v_month_starts_at)) / 604800)::integer
      );
      -- The last whole week takes the days left over after it.
      v_last_week := greatest(1, floor(v_month_seconds / 604800)::integer) - 1;
      if pass_ends_at is not null and v_weeks >= v_last_week then
        v_weeks := v_last_week;
        starts_at := v_month_starts_at + make_interval(days => 7 * v_weeks);
        ends_at := pass_ends_at;
      else
        starts_at := v_month_starts_at + make_interval(days => 7 * v_weeks);
        ends_at := starts_at + interval '7 days';
      end if;
      if v_plan.pass_budget_microusd is not null and v_month_seconds > 0 then
        budget_microusd := round(
          v_plan.pass_budget_microusd * extract(epoch from (ends_at - starts_at)) / v_month_seconds
        )::bigint;
      end if;
    end if;
  end if;

  -- Credits (3100): what is left of every top-up, added to this period's allowance, so it is
  -- spent once the period's own share is gone. They never expire.
  if budget_microusd is not null then
    budget_microusd := budget_microusd + public.tensor_credit_balance(v_account.id, starts_at);
  end if;

  select coalesce(sum(p.cost_used_microusd), 0)::bigint into pass_cost_used_microusd
  from public.basecode_usage_periods p
  where p.account_id = v_account.id
    and p.plan_code = v_plan.code
    and p.starts_at >= v_month_starts_at
    and (pass_ends_at is null or p.starts_at < pass_ends_at);

  -- Under its own name: a bare starts_at below would be read as the column.
  v_starts_at := starts_at;
  select coalesce(max(greatest(p.cost_used_microusd - p.cost_reset_microusd, 0)), 0)::bigint
  into cost_used_microusd
  from public.basecode_usage_periods p
  where p.account_id = v_account.id
    and p.plan_code = v_plan.code
    and p.starts_at = v_starts_at;

  return next;
end;
$$;

revoke all on function public.basecode_allowance_period(uuid, timestamptz) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.basecode_allowance_period(uuid, timestamptz) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.basecode_allowance_period(uuid, timestamptz) to service_role;
  end if;
end $$;

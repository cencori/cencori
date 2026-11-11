-- Paid Tensor allowances reset every week (2026-11-10).
--
-- A pass was one allowance for its whole 30 days, so someone who used it up in the
-- first week waited three more for anything to come back. Only the trial is meant to
-- be monthly. A pass now gives a quarter of what it did, every week:
--
--            a week    was, a pass
--   starter      9         35
--   builder     25        100
--   pro         15         60
--
-- Weeks are counted from the moment the pass started, not from the calendar, so no
-- one gets a short first week. The last window of a pass is the two days left over
-- after four weeks; it gets a full week's tasks too, so a pass is never worth less
-- than it was.
--
-- The cost ceiling does not move: it is still one figure for the whole pass, summed
-- across its weeks, which is what keeps a sale from costing more than it brought in.
-- The trial is untouched: five tasks a month.
--
-- A pass already running under the old allowance keeps it until it ends. Cutting a
-- pass someone has paid for into weeks part-way through could leave them with fewer
-- tasks than they bought. Such a pass is recognised by its usage period, which spans
-- the whole pass rather than a week; nothing opens one of those from here on.
--
-- Safe to run against the backend that is live today: it reads its allowance from
-- the functions below, and shows the weekly figures once the new backend is deployed.

-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts, inside its transaction.

update public.basecode_plans
set task_limit = case code
  when 'starter' then 9
  when 'builder' then 25
  when 'pro' then 15
end
where code in ('starter', 'builder', 'pro');

comment on column public.basecode_plans.task_limit is
  'Tasks in one allowance period: a week of a pass, or a month of the trial (code free). Null is unlimited.';

comment on column public.basecode_plans.pass_budget_microusd is
  'Provider cost the whole pass may reach, summed across its weeks. Null is no ceiling.';

-- ── The allowance an account is in ───────────────────────────────────────
-- The one place that says which period an account's tasks count against, how many
-- it allows, and how much of the pass's cost ceiling is gone. The reservation and the
-- usage screen both read it, so they cannot disagree about where a week starts.
-- Dropped first so this file can run again after the second half changed what it returns.
drop function if exists public.basecode_allowance_period(uuid, timestamptz);

create or replace function public.basecode_allowance_period(
  p_account_id uuid,
  p_at timestamptz default now()
)
returns table (
  plan_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  task_limit integer,
  pass_ends_at timestamptz,
  pass_cost_used_microusd bigint
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
  v_pass_starts_at timestamptz;
  v_weeks integer;
  v_cost_from timestamptz;
  v_cost_until timestamptz;
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
  task_limit := v_plan.task_limit;

  if v_plan.code = 'free' then
    select t.starts_at, t.ends_at into starts_at, ends_at
    from public.basecode_trial_period(v_account.created_at, p_at) t;
    pass_ends_at := ends_at;
  else
    v_pass_starts_at := coalesce(v_account.entitlement_starts_at, v_account.created_at);
    pass_ends_at := v_account.entitlement_ends_at;

    -- A pass bought under the per-pass allowance has one period as long as the pass.
    select * into v_legacy
    from public.basecode_usage_periods p
    where p.account_id = v_account.id
      and p.plan_code = v_plan.code
      and p.starts_at = v_pass_starts_at
      and p.ends_at > v_pass_starts_at + interval '7 days';

    if found then
      starts_at := v_pass_starts_at;
      ends_at := pass_ends_at;
      task_limit := v_legacy.request_limit;
    else
      v_weeks := greatest(
        0,
        floor(extract(epoch from (p_at - v_pass_starts_at)) / 604800)::integer
      );
      starts_at := v_pass_starts_at + make_interval(days => 7 * v_weeks);
      ends_at := starts_at + interval '7 days';
      if pass_ends_at is not null and ends_at > pass_ends_at then
        ends_at := pass_ends_at;
      end if;
    end if;
  end if;

  -- For the trial this is its own month; for a pass, every week of it so far.
  v_cost_from := case when v_plan.code = 'free' then starts_at else v_pass_starts_at end;
  v_cost_until := pass_ends_at;
  select coalesce(sum(p.cost_used_microusd), 0)::bigint into pass_cost_used_microusd
  from public.basecode_usage_periods p
  where p.account_id = v_account.id
    and p.plan_code = v_plan.code
    and p.starts_at >= v_cost_from
    and (v_cost_until is null or p.starts_at < v_cost_until);

  return next;
end;
$$;

revoke all on function public.basecode_allowance_period(uuid, timestamptz) from public;
grant execute on function public.basecode_allowance_period(uuid, timestamptz) to service_role;

-- ── Reserving a task ─────────────────────────────────────────────────────
-- As before, except that a pass counts its tasks by the week and its cost by the pass.
create or replace function public.basecode_reserve_turn(
  p_user_id uuid,
  p_client_turn_key uuid,
  p_model text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.basecode_billing_accounts%rowtype;
  v_plan public.basecode_plans%rowtype;
  v_period public.basecode_usage_periods%rowtype;
  v_existing public.basecode_turn_reservations%rowtype;
  v_reservation public.basecode_turn_reservations%rowtype;
  v_allowance record;
begin
  if p_user_id is null or p_client_turn_key is null then
    raise exception 'invalid_basecode_reservation';
  end if;

  insert into public.basecode_billing_accounts(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_account
  from public.basecode_billing_accounts
  where user_id = p_user_id
  for update;

  select * into v_existing
  from public.basecode_turn_reservations
  where account_id = v_account.id and client_turn_key = p_client_turn_key;

  if found then
    return jsonb_build_object(
      'allowed', v_existing.status in ('reserved', 'running'),
      'reservation_id', v_existing.id,
      'status', v_existing.status
    );
  end if;

  select * into v_allowance from public.basecode_allowance_period(v_account.id);
  select * into v_plan from public.basecode_plans where code = v_allowance.plan_code and enabled;
  if not found then
    raise exception 'basecode_plan_unavailable';
  end if;

  insert into public.basecode_usage_periods(
    account_id, plan_code, starts_at, ends_at, request_limit, budget_microusd
  ) values (
    v_account.id, v_plan.code, v_allowance.starts_at, v_allowance.ends_at,
    v_allowance.task_limit, v_plan.pass_budget_microusd
  )
  on conflict (account_id, plan_code, starts_at) do update set
    request_limit = excluded.request_limit,
    budget_microusd = excluded.budget_microusd,
    ends_at = excluded.ends_at,
    updated_at = now()
  returning * into v_period;

  -- No limit on how many tasks run at once (2026-11-11). Every plan may run several together:
  -- each one still counts against the week's tasks and the month's cost, so running more at once
  -- only uses the allowance sooner. The one-at-a-time rule this replaces also locked accounts out
  -- for two hours whenever a finished task's release never arrived. max_concurrent_turns stays on
  -- the plan and is no longer read.

  if v_allowance.task_limit is not null and v_period.requests_used >= v_allowance.task_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', case when v_plan.code = 'free' then 'trial_limit' else 'task_limit' end,
      'plan', v_plan.code,
      'percentage_used', 100,
      'tasks_used', v_period.requests_used,
      'tasks_limit', v_allowance.task_limit,
      'reset_at', v_allowance.ends_at
    );
  end if;

  -- The ceiling is the pass's, so reaching it lasts until the pass ends, not the week.
  if v_plan.pass_budget_microusd is not null
    and v_allowance.pass_cost_used_microusd >= v_plan.pass_budget_microusd then
    return jsonb_build_object(
      'allowed', false, 'reason', 'pass_budget_limit',
      'plan', v_plan.code,
      'percentage_used', 100,
      'tasks_used', v_period.requests_used,
      'tasks_limit', v_allowance.task_limit,
      'reset_at', v_allowance.pass_ends_at
    );
  end if;

  update public.basecode_usage_periods
  set requests_used = requests_used + 1
  where id = v_period.id
  returning * into v_period;

  insert into public.basecode_turn_reservations(
    account_id, usage_period_id, client_turn_key, model,
    reserved_microusd, cost_cap_microusd, expires_at
  ) values (
    v_account.id, v_period.id, p_client_turn_key,
    nullif(left(coalesce(p_model, ''), 160), ''),
    0, v_plan.task_cost_cap_microusd, now() + interval '2 hours'
  ) returning * into v_reservation;

  insert into public.basecode_usage_events(
    account_id, usage_period_id, reservation_id, kind, request_delta, cost_delta_microusd
  ) values (
    v_account.id, v_period.id, v_reservation.id, 'reserve', 1, 0
  );

  return jsonb_build_object(
    'allowed', true,
    'reservation_id', v_reservation.id,
    'plan', v_plan.code,
    'model_policy', v_plan.model_policy,
    'percentage_used', case
      when v_allowance.task_limit is null then 0
      else least(100, round(100.0 * v_period.requests_used / v_allowance.task_limit))
    end,
    'tasks_used', v_period.requests_used,
    'tasks_limit', v_allowance.task_limit,
    'task_cost_cap_microusd', v_plan.task_cost_cap_microusd,
    'reset_at', v_allowance.ends_at
  );
end;
$$;

-- ── Each model call inside a task ────────────────────────────────────────
-- As before, except that the cost ceiling is checked across the whole pass.
create or replace function public.basecode_gateway_access(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.basecode_billing_accounts%rowtype;
  v_plan public.basecode_plans%rowtype;
  v_period public.basecode_usage_periods%rowtype;
  v_reservation public.basecode_turn_reservations%rowtype;
  v_plan_code text;
  v_reset_at timestamptz;
  v_pass_cost bigint;
begin
  select * into v_account
  from public.basecode_billing_accounts
  where user_id = p_user_id;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'account_missing');
  end if;

  v_plan_code := public.basecode_effective_plan(v_account);
  select * into v_plan from public.basecode_plans where code = v_plan_code and enabled;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'plan_unavailable');
  end if;

  select * into v_reservation
  from public.basecode_turn_reservations
  where account_id = v_account.id
    and status in ('reserved', 'running')
    and expires_at > now()
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'turn_not_reserved', 'plan', v_plan.code);
  end if;

  select * into v_period from public.basecode_usage_periods where id = v_reservation.usage_period_id;
  -- A task opened under the last period may still be running; its period is the one
  -- that ends, so that end is the reset to report.
  v_reset_at := v_period.ends_at;

  if v_reservation.cost_cap_microusd is not null
    and v_reservation.actual_cost_microusd >= v_reservation.cost_cap_microusd then
    return jsonb_build_object(
      'allowed', false, 'reason', 'task_cost_limit',
      'plan', v_plan.code, 'reset_at', v_reset_at
    );
  end if;

  -- A pass's ceiling covers every week of it. The trial's period is its own.
  if v_period.plan_code = 'free' or v_account.entitlement_starts_at is null then
    v_pass_cost := v_period.cost_used_microusd;
  else
    select coalesce(sum(p.cost_used_microusd), 0)::bigint into v_pass_cost
    from public.basecode_usage_periods p
    where p.account_id = v_account.id
      and p.plan_code = v_period.plan_code
      and p.starts_at >= v_account.entitlement_starts_at
      and (v_account.entitlement_ends_at is null or p.starts_at < v_account.entitlement_ends_at);
    v_pass_cost := greatest(v_pass_cost, v_period.cost_used_microusd);
  end if;

  if v_period.budget_microusd is not null and v_pass_cost >= v_period.budget_microusd then
    return jsonb_build_object(
      'allowed', false, 'reason', 'pass_budget_limit',
      'plan', v_plan.code,
      'reset_at', case
        when v_period.plan_code = 'free' then v_reset_at
        else coalesce(v_account.entitlement_ends_at, v_reset_at)
      end
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reservation_id', v_reservation.id,
    'plan', v_plan.code,
    'model_policy', v_plan.model_policy,
    'reset_at', v_reset_at
  );
end;
$$;



-- ════════════════════════════════════════════════════════════════════════
-- Second half: the subscription ladder. Kept in the same file so both halves
-- are applied in one transaction, or neither is.
-- ════════════════════════════════════════════════════════════════════════

-- Tensor's five-plan ladder, and subscriptions (2026-11-10).
--
-- Run after 20261110_000001. Two things change.
--
-- 1. The ladder. Three plans where Tensor picks the model, counted in tasks a week,
--    and two where the customer picks any model, counted in what the models cost:
--
--                naira       dollars   a week       the month's cost ceiling   model
--     starter    ₦2,000      $2          9 tasks    $1.00                      Tensor picks
--     builder    ₦5,000      $5         27 tasks    $2.50                      Tensor picks
--     pro        ₦15,000     $15        81 tasks    $7.50                      Tensor picks
--     max        ₦30,000     $20        no count    $11.00                     any
--     ultra      ₦150,000    $100       no count    $57.00                     any
--
--    Max and Ultra have no task count: their ceiling is the allowance, shown to the
--    customer as a percentage, so a cheap model spends it slowly and a frontier one
--    quickly. Each ceiling is about 60% of what the plan nets after payment fees.
--
--    Builder used to offer the open-weight models and Pro the frontier ones. A pass
--    already running keeps the models it was bought with until the day it was due to
--    end (model_policy_override on the account), whatever is paid for after it.
--
-- 2. Subscriptions. A plan is now a month that renews. Paid by card in dollars it
--    renews by itself: Bachs bills each month as an invoice, and a paid invoice moves
--    the account's month forward. Paid in naira it is still one payment for one month,
--    because Bachs cannot yet bill naira on a schedule; paying again before the month
--    ends adds the new month to the end of the current one instead of restarting it.
--
-- A month's allowance is counted inside the month it belongs to, so an account that
-- has paid two months ahead still gets one month's cost ceiling at a time.
--
-- Safe to run against the backend that is live today: the plans it sells keep their
-- codes and prices, and every function it calls keeps its name and arguments.

-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts, inside its transaction.

-- ── Plans ────────────────────────────────────────────────────────────────
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.basecode_plans'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%code%'
  loop
    execute format('alter table public.basecode_plans drop constraint %I', v_name);
  end loop;
end;
$$;

alter table public.basecode_plans
  add constraint basecode_plans_code_check
  check (code in ('free', 'starter', 'builder', 'pro', 'max', 'ultra', 'enterprise'));

insert into public.basecode_plans (
  code, name, price_ngn_minor, price_usd_minor, billing_period_days,
  task_limit, task_cost_cap_microusd, pass_budget_microusd, model_policy, max_concurrent_turns
) values
  ('starter', 'Starter', 200000, 200, 30, 9, null, 1000000, 'auto', 1),
  ('builder', 'Builder', 500000, 500, 30, 27, null, 2500000, 'auto', 1),
  ('pro', 'Pro', 1500000, 1500, 30, 81, null, 7500000, 'auto', 1),
  ('max', 'Max', 3000000, 2000, 30, null, null, 11000000, 'frontier', 1),
  ('ultra', 'Ultra', 15000000, 10000, 30, null, null, 57000000, 'frontier', 2)
on conflict (code) do update set
  name = excluded.name,
  price_ngn_minor = excluded.price_ngn_minor,
  price_usd_minor = excluded.price_usd_minor,
  billing_period_days = excluded.billing_period_days,
  task_limit = excluded.task_limit,
  pass_budget_microusd = excluded.pass_budget_microusd,
  model_policy = excluded.model_policy,
  max_concurrent_turns = excluded.max_concurrent_turns,
  enabled = true;

comment on table public.basecode_plans is
  'Tensor plans. A plan is a month: tasks a week for the plans Tensor picks the model on, a cost ceiling for the month on all of them. The code free is the trial.';

-- ── Accounts ─────────────────────────────────────────────────────────────
alter table public.basecode_billing_accounts
  add column if not exists model_policy_override text check (
    model_policy_override is null
    or model_policy_override in ('auto', 'open_weight', 'frontier', 'custom')
  ),
  add column if not exists model_policy_override_until timestamptz,
  add column if not exists provider_customer_id text,
  add column if not exists renewal_reminders_sent text[] not null default '{}',
  add column if not exists renewal_reminders_for timestamptz;

comment on column public.basecode_billing_accounts.model_policy_override is
  'The models a pass bought before the ladder changed still has, until model_policy_override_until.';
comment on column public.basecode_billing_accounts.provider_customer_id is
  'The Bachs customer a card subscription is billed to.';

-- A pass that is running keeps the models it was sold with.
update public.basecode_billing_accounts
set
  model_policy_override = case plan_code when 'builder' then 'open_weight' else 'frontier' end,
  model_policy_override_until = entitlement_ends_at
where plan_code in ('builder', 'pro')
  and status = 'active'
  and entitlement_ends_at > now()
  and model_policy_override is null;

comment on column public.basecode_billing_accounts.renewal_reminders_sent is
  'Renewal reminders already sent for the month ending at renewal_reminders_for, so each goes once.';

-- ── Subscriptions ────────────────────────────────────────────────────────
create table if not exists public.basecode_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.basecode_billing_accounts(id) on delete cascade,
  plan_code text not null references public.basecode_plans(code),
  provider text not null check (provider in ('bachs')),
  provider_subscription_id text not null,
  status text not null check (
    status in ('trialing', 'active', 'past_due', 'unpaid', 'canceled', 'paused')
  ),
  currency text not null default 'USD' check (currency in ('NGN', 'USD')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

alter table public.basecode_subscriptions enable row level security;
revoke all on table public.basecode_subscriptions from anon, authenticated;
grant all on table public.basecode_subscriptions to service_role;

comment on table public.basecode_subscriptions is
  'The card subscription an account renews on, as Bachs last reported it. One per account; a naira month has none.';

-- A renewal is paid by an invoice, not through a checkout of ours.
alter table public.basecode_payments
  alter column checkout_session_id drop not null;

-- ── Putting a paid month on an account ───────────────────────────────────
-- The one place a plan is put on an account by a single payment. Paying for the plan
-- already running adds a month to its end; anything else starts a month now.
create or replace function public.basecode_grant_pass(
  p_account_id uuid,
  p_plan_code text,
  p_starts_at timestamptz default now()
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.basecode_plans%rowtype;
  v_account public.basecode_billing_accounts%rowtype;
  v_starts_at timestamptz := coalesce(p_starts_at, now());
  v_ends_at timestamptz;
begin
  select * into v_plan from public.basecode_plans where code = p_plan_code and enabled;
  if not found or v_plan.code = 'free' then
    raise exception 'basecode_paid_plan_unavailable';
  end if;

  select * into v_account
  from public.basecode_billing_accounts
  where id = p_account_id
  for update;
  if not found then raise exception 'basecode_account_missing'; end if;

  -- Renewing early must not cost the days still left.
  if v_account.plan_code = v_plan.code
    and v_account.status = 'active'
    and v_account.entitlement_starts_at is not null
    and v_account.entitlement_ends_at > v_starts_at then
    v_ends_at := v_account.entitlement_ends_at + make_interval(days => v_plan.billing_period_days);
    update public.basecode_billing_accounts
    set entitlement_ends_at = v_ends_at
    where id = p_account_id;
    return v_ends_at;
  end if;

  v_ends_at := v_starts_at + make_interval(days => v_plan.billing_period_days);
  update public.basecode_billing_accounts
  set
    plan_code = v_plan.code,
    status = 'active',
    entitlement_starts_at = v_starts_at,
    entitlement_ends_at = v_ends_at,
    model_policy_override = null,
    model_policy_override_until = null
  where id = p_account_id;

  return v_ends_at;
end;
$$;

-- As before, with Max and Ultra for sale.
create or replace function public.basecode_apply_pass_payment(
  p_checkout_session_id uuid,
  p_provider_transaction_id text,
  p_amount_minor bigint,
  p_currency text,
  p_payment_method text,
  p_paid_at timestamptz,
  p_provider_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkout public.basecode_checkout_sessions%rowtype;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_starts_at timestamptz := now();
  v_ends_at timestamptz;
begin
  select * into v_checkout
  from public.basecode_checkout_sessions
  where id = p_checkout_session_id
  for update;

  if not found then raise exception 'basecode_checkout_not_found'; end if;
  if v_checkout.status = 'paid' then
    return jsonb_build_object('applied', false, 'duplicate', true, 'account_id', v_checkout.account_id);
  end if;
  if v_checkout.status <> 'pending' then raise exception 'basecode_checkout_not_pending'; end if;
  -- Provider delivery can be delayed. A payment made before the checkout expired is
  -- honoured even when its webhook arrives later; one initiated after is not.
  if v_checkout.expires_at <= v_paid_at then raise exception 'basecode_checkout_expired'; end if;
  if p_amount_minor < v_checkout.expected_amount_minor then raise exception 'basecode_payment_underpaid'; end if;
  if upper(p_currency) <> v_checkout.currency then raise exception 'basecode_payment_currency_mismatch'; end if;
  if nullif(trim(p_provider_transaction_id), '') is null then raise exception 'basecode_payment_id_missing'; end if;
  if v_checkout.plan_code not in ('starter', 'builder', 'pro', 'max', 'ultra') then
    raise exception 'basecode_paid_plan_unavailable';
  end if;

  insert into public.basecode_payments(
    account_id, checkout_session_id, provider, provider_transaction_id,
    reference, amount_minor, currency, status, payment_method, provider_payload, paid_at
  ) values (
    v_checkout.account_id, v_checkout.id, v_checkout.provider,
    left(trim(p_provider_transaction_id), 200), v_checkout.reference,
    p_amount_minor, upper(p_currency), 'successful',
    nullif(left(coalesce(p_payment_method, ''), 100), ''),
    coalesce(p_provider_payload, '{}'::jsonb),
    v_paid_at
  )
  on conflict (provider, provider_transaction_id) do nothing;

  -- A conflicting row means this provider transaction was already applied.
  if not found then
    update public.basecode_checkout_sessions set status = 'paid', paid_at = v_paid_at
    where id = v_checkout.id;
    return jsonb_build_object('applied', false, 'duplicate', true, 'account_id', v_checkout.account_id);
  end if;

  -- The month runs from when it is granted, not from when the money moved, so a
  -- late webhook never shortens what was paid for.
  v_ends_at := public.basecode_grant_pass(v_checkout.account_id, v_checkout.plan_code, v_starts_at);

  update public.basecode_checkout_sessions
  set status = 'paid', paid_at = v_paid_at
  where id = v_checkout.id;

  return jsonb_build_object(
    'applied', true,
    'account_id', v_checkout.account_id,
    'plan', v_checkout.plan_code,
    'period_start', v_starts_at,
    'period_end', v_ends_at
  );
end;
$$;

-- ── A subscription's paid month ──────────────────────────────────────────
-- Called for each month a card subscription pays for: the first charge, then every
-- paid invoice. The payment is recorded once however often the provider says so; the
-- month it paid for is put on the account every time, so a later, more exact report
-- of the same month's dates corrects an earlier estimate.
create or replace function public.basecode_apply_subscription_period(
  p_account_id uuid,
  p_plan_code text,
  p_provider_subscription_id text,
  p_provider_transaction_id text,
  p_reference text,
  p_amount_minor bigint,
  p_currency text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_provider_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.basecode_plans%rowtype;
  v_account public.basecode_billing_accounts%rowtype;
  v_price bigint;
  v_recorded boolean := false;
begin
  select * into v_plan from public.basecode_plans where code = p_plan_code and enabled;
  if not found or v_plan.code not in ('starter', 'builder', 'pro', 'max', 'ultra') then
    raise exception 'basecode_paid_plan_unavailable';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception 'basecode_subscription_period_invalid';
  end if;
  select * into v_account
  from public.basecode_billing_accounts
  where id = p_account_id
  for update;
  if not found then raise exception 'basecode_account_missing'; end if;

  if nullif(trim(p_provider_transaction_id), '') is not null then
    v_price := case upper(p_currency)
      when 'NGN' then v_plan.price_ngn_minor
      when 'USD' then v_plan.price_usd_minor
    end;
    if v_price is null or p_amount_minor < v_price then
      raise exception 'basecode_payment_underpaid';
    end if;

    insert into public.basecode_payments(
      account_id, checkout_session_id, provider, provider_transaction_id,
      reference, amount_minor, currency, status, provider_payload, paid_at
    ) values (
      v_account.id, null, 'bachs',
      left(trim(p_provider_transaction_id), 200),
      left(coalesce(nullif(trim(p_reference), ''), trim(p_provider_transaction_id)), 200),
      p_amount_minor, upper(p_currency), 'successful',
      coalesce(p_provider_payload, '{}'::jsonb), now()
    )
    on conflict do nothing;
    v_recorded := found;
  end if;

  -- The first charge can arrive before the provider has said which subscription it
  -- opened; the subscription's own event records it then.
  if nullif(trim(p_provider_subscription_id), '') is not null then
    insert into public.basecode_subscriptions(
      account_id, plan_code, provider, provider_subscription_id, status, currency,
      current_period_start, current_period_end
    ) values (
      v_account.id, v_plan.code, 'bachs', left(trim(p_provider_subscription_id), 200), 'active',
      upper(p_currency), p_period_start, p_period_end
    )
    on conflict (account_id) do update set
      plan_code = excluded.plan_code,
      provider_subscription_id = excluded.provider_subscription_id,
      status = 'active',
      currency = excluded.currency,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      updated_at = now();
  end if;

  update public.basecode_billing_accounts
  set
    plan_code = v_plan.code,
    status = 'active',
    entitlement_starts_at = p_period_start,
    entitlement_ends_at = p_period_end,
    model_policy_override = null,
    model_policy_override_until = null
  where id = v_account.id;

  return jsonb_build_object(
    'applied', true,
    'payment_recorded', v_recorded,
    'account_id', v_account.id,
    'plan', v_plan.code,
    'period_start', p_period_start,
    'period_end', p_period_end
  );
end;
$$;

revoke all on function public.basecode_apply_subscription_period(
  uuid, text, text, text, text, bigint, text, timestamptz, timestamptz, jsonb
) from public;
grant execute on function public.basecode_apply_subscription_period(
  uuid, text, text, text, text, bigint, text, timestamptz, timestamptz, jsonb
) to service_role;

-- ── Reminding a month that will not renew itself ─────────────────────────
-- A month paid for in naira ends unless it is paid for again, so the account is told
-- as the end comes. Each reminder is claimed here before it is sent: true the first
-- time it is asked for a given month's end, false ever after, however often the job
-- runs. A month that is extended has a new end, and its reminders start over.
create or replace function public.basecode_claim_renewal_reminder(
  p_account_id uuid,
  p_kinds text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean;
begin
  if coalesce(array_length(p_kinds, 1), 0) = 0 then
    return false;
  end if;

  update public.basecode_billing_accounts a
  set
    renewal_reminders_sent = (
      select array(
        select distinct kind
        from unnest(
          case
            when a.renewal_reminders_for is not distinct from a.entitlement_ends_at
              then a.renewal_reminders_sent
            else '{}'::text[]
          end || p_kinds
        ) as kind
      )
    ),
    renewal_reminders_for = a.entitlement_ends_at
  where a.id = p_account_id
    and a.entitlement_ends_at is not null
    and not (
      a.renewal_reminders_for is not distinct from a.entitlement_ends_at
      and a.renewal_reminders_sent @> array[p_kinds[array_upper(p_kinds, 1)]]
    );
  get diagnostics v_claimed = row_count;
  return v_claimed;
end;
$$;

revoke all on function public.basecode_claim_renewal_reminder(uuid, text[]) from public;
grant execute on function public.basecode_claim_renewal_reminder(uuid, text[]) to service_role;

-- ── The allowance an account is in ───────────────────────────────────────
-- As in 000001, with two differences: the cost ceiling is counted inside the paid
-- month the account is in, not across everything paid ahead, and the answer carries
-- the models the account may use.
drop function if exists public.basecode_allowance_period(uuid, timestamptz);

create function public.basecode_allowance_period(
  p_account_id uuid,
  p_at timestamptz default now()
)
returns table (
  plan_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  task_limit integer,
  pass_ends_at timestamptz,
  pass_cost_used_microusd bigint,
  model_policy text
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
  v_months integer;
  v_month integer;
  v_weeks integer;
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
  task_limit := v_plan.task_limit;
  model_policy := v_plan.model_policy;

  if v_plan.code = 'free' then
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

    -- A pass bought under the per-pass allowance has one period as long as the pass.
    select * into v_legacy
    from public.basecode_usage_periods p
    where p.account_id = v_account.id
      and p.plan_code = v_plan.code
      and p.starts_at = v_paid_from
      and p.ends_at > v_paid_from + interval '7 days';

    if found and v_month = 0 then
      starts_at := v_paid_from;
      ends_at := pass_ends_at;
      task_limit := v_legacy.request_limit;
    else
      v_weeks := greatest(
        0,
        floor(extract(epoch from (p_at - v_month_starts_at)) / 604800)::integer
      );
      starts_at := v_month_starts_at + make_interval(days => 7 * v_weeks);
      ends_at := starts_at + interval '7 days';
      if pass_ends_at is not null and ends_at > pass_ends_at then
        ends_at := pass_ends_at;
      end if;
    end if;
  end if;

  select coalesce(sum(p.cost_used_microusd), 0)::bigint into pass_cost_used_microusd
  from public.basecode_usage_periods p
  where p.account_id = v_account.id
    and p.plan_code = v_plan.code
    and p.starts_at >= v_month_starts_at
    and (pass_ends_at is null or p.starts_at < pass_ends_at);

  return next;
end;
$$;

revoke all on function public.basecode_allowance_period(uuid, timestamptz) from public;
grant execute on function public.basecode_allowance_period(uuid, timestamptz) to service_role;

-- ── Reserving a task ─────────────────────────────────────────────────────
-- As in 000001, answering with the models the account may use rather than the plan's.
create or replace function public.basecode_reserve_turn(
  p_user_id uuid,
  p_client_turn_key uuid,
  p_model text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.basecode_billing_accounts%rowtype;
  v_plan public.basecode_plans%rowtype;
  v_period public.basecode_usage_periods%rowtype;
  v_existing public.basecode_turn_reservations%rowtype;
  v_reservation public.basecode_turn_reservations%rowtype;
  v_allowance record;
begin
  if p_user_id is null or p_client_turn_key is null then
    raise exception 'invalid_basecode_reservation';
  end if;

  insert into public.basecode_billing_accounts(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_account
  from public.basecode_billing_accounts
  where user_id = p_user_id
  for update;

  select * into v_existing
  from public.basecode_turn_reservations
  where account_id = v_account.id and client_turn_key = p_client_turn_key;

  if found then
    return jsonb_build_object(
      'allowed', v_existing.status in ('reserved', 'running'),
      'reservation_id', v_existing.id,
      'status', v_existing.status
    );
  end if;

  select * into v_allowance from public.basecode_allowance_period(v_account.id);
  select * into v_plan from public.basecode_plans where code = v_allowance.plan_code and enabled;
  if not found then
    raise exception 'basecode_plan_unavailable';
  end if;

  insert into public.basecode_usage_periods(
    account_id, plan_code, starts_at, ends_at, request_limit, budget_microusd
  ) values (
    v_account.id, v_plan.code, v_allowance.starts_at, v_allowance.ends_at,
    v_allowance.task_limit, v_plan.pass_budget_microusd
  )
  on conflict (account_id, plan_code, starts_at) do update set
    request_limit = excluded.request_limit,
    budget_microusd = excluded.budget_microusd,
    ends_at = excluded.ends_at,
    updated_at = now()
  returning * into v_period;

  -- No limit on how many tasks run at once (2026-11-11). Every plan may run several together:
  -- each one still counts against the week's tasks and the month's cost, so running more at once
  -- only uses the allowance sooner. The one-at-a-time rule this replaces also locked accounts out
  -- for two hours whenever a finished task's release never arrived. max_concurrent_turns stays on
  -- the plan and is no longer read.

  if v_allowance.task_limit is not null and v_period.requests_used >= v_allowance.task_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', case when v_plan.code = 'free' then 'trial_limit' else 'task_limit' end,
      'plan', v_plan.code,
      'percentage_used', 100,
      'tasks_used', v_period.requests_used,
      'tasks_limit', v_allowance.task_limit,
      'reset_at', v_allowance.ends_at
    );
  end if;

  -- The ceiling is the month's, so reaching it lasts until the month ends, not the week.
  if v_plan.pass_budget_microusd is not null
    and v_allowance.pass_cost_used_microusd >= v_plan.pass_budget_microusd then
    return jsonb_build_object(
      'allowed', false, 'reason', 'pass_budget_limit',
      'plan', v_plan.code,
      'percentage_used', 100,
      'tasks_used', v_period.requests_used,
      'tasks_limit', v_allowance.task_limit,
      'reset_at', v_allowance.pass_ends_at
    );
  end if;

  update public.basecode_usage_periods
  set requests_used = requests_used + 1
  where id = v_period.id
  returning * into v_period;

  insert into public.basecode_turn_reservations(
    account_id, usage_period_id, client_turn_key, model,
    reserved_microusd, cost_cap_microusd, expires_at
  ) values (
    v_account.id, v_period.id, p_client_turn_key,
    nullif(left(coalesce(p_model, ''), 160), ''),
    0, v_plan.task_cost_cap_microusd, now() + interval '2 hours'
  ) returning * into v_reservation;

  insert into public.basecode_usage_events(
    account_id, usage_period_id, reservation_id, kind, request_delta, cost_delta_microusd
  ) values (
    v_account.id, v_period.id, v_reservation.id, 'reserve', 1, 0
  );

  return jsonb_build_object(
    'allowed', true,
    'reservation_id', v_reservation.id,
    'plan', v_plan.code,
    'model_policy', v_allowance.model_policy,
    'percentage_used', case
      when v_allowance.task_limit is not null then
        least(100, round(100.0 * v_period.requests_used / v_allowance.task_limit))
      when v_plan.pass_budget_microusd is not null then
        least(100, round(100.0 * v_allowance.pass_cost_used_microusd / v_plan.pass_budget_microusd))
      else 0
    end,
    'tasks_used', v_period.requests_used,
    'tasks_limit', v_allowance.task_limit,
    'task_cost_cap_microusd', v_plan.task_cost_cap_microusd,
    'reset_at', v_allowance.ends_at
  );
end;
$$;

-- ── Each model call inside a task ────────────────────────────────────────
-- As in 000001, with the month's ceiling and the account's own models.
create or replace function public.basecode_gateway_access(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.basecode_billing_accounts%rowtype;
  v_plan public.basecode_plans%rowtype;
  v_period public.basecode_usage_periods%rowtype;
  v_reservation public.basecode_turn_reservations%rowtype;
  v_allowance record;
  v_reset_at timestamptz;
  v_month_cost bigint;
begin
  select * into v_account
  from public.basecode_billing_accounts
  where user_id = p_user_id;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'account_missing');
  end if;

  select * into v_plan
  from public.basecode_plans
  where code = public.basecode_effective_plan(v_account) and enabled;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'plan_unavailable');
  end if;

  select * into v_reservation
  from public.basecode_turn_reservations
  where account_id = v_account.id
    and status in ('reserved', 'running')
    and expires_at > now()
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'turn_not_reserved', 'plan', v_plan.code);
  end if;

  select * into v_period from public.basecode_usage_periods where id = v_reservation.usage_period_id;
  -- A task opened under the last period may still be running; its period is the one
  -- that ends, so that end is the reset to report.
  v_reset_at := v_period.ends_at;

  if v_reservation.cost_cap_microusd is not null
    and v_reservation.actual_cost_microusd >= v_reservation.cost_cap_microusd then
    return jsonb_build_object(
      'allowed', false, 'reason', 'task_cost_limit',
      'plan', v_plan.code, 'reset_at', v_reset_at
    );
  end if;

  select * into v_allowance from public.basecode_allowance_period(v_account.id);
  -- The month's ceiling when the task belongs to the plan the account is on now; a
  -- task still running from a plan that has since ended answers to its own period.
  v_month_cost := case
    when v_period.plan_code = v_allowance.plan_code
      then greatest(v_allowance.pass_cost_used_microusd, v_period.cost_used_microusd)
    else v_period.cost_used_microusd
  end;

  if v_period.budget_microusd is not null and v_month_cost >= v_period.budget_microusd then
    return jsonb_build_object(
      'allowed', false, 'reason', 'pass_budget_limit',
      'plan', v_plan.code,
      'reset_at', case
        when v_period.plan_code = v_allowance.plan_code
          then coalesce(v_allowance.pass_ends_at, v_reset_at)
        else v_reset_at
      end
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reservation_id', v_reservation.id,
    'plan', v_plan.code,
    'model_policy', v_allowance.model_policy,
    'reset_at', v_reset_at
  );
end;
$$;


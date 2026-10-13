-- Tensor billing rebuild, part 1 of 2 (2026-10-13).
--
-- One model, replacing the three that had piled up (weekly free requests, weekly
-- cost budgets, and a prepaid wallet):
--
--   A plan is a 30-day pass. A pass is a number of tasks. A task has a cost ceiling,
--   and so does the pass.
--
--                           tasks            a task   the pass
--   trial    free, once     5, ever          $0.08    $0.25
--   starter  ₦2,000 / $2    35 in 30 days    $0.08    $1.00
--   builder  ₦5,000 / $5    100 in 30 days   $0.10    $2.50
--   pro      ₦15,000 / $15  60 in 30 days    $0.50    $7.50
--
-- The pass ceiling is the number that makes a sale impossible to lose money on: it
-- is below what the naira price nets after payment fees (about $1.24, $3.10, $9.50),
-- and no pass can cost more than it to serve. At measured costs (about $0.02 a task
-- on DeepSeek) nobody on Starter or Builder reaches it before running out of tasks;
-- it exists for the account that finds the expensive path. The task ceiling keeps
-- one runaway task from eating the pass.
--
-- There is no free plan. The `free` code stays as the internal name of the trial,
-- because every account defaults to it, the deployed backend creates accounts with
-- it, and released desktop builds only accept free/builder/pro/enterprise.
--
-- This part is safe to run against the backend that is live today: no column or
-- table it reads is removed, and both payment functions it calls now grant a pass.
-- Part 2 removes the wallet, packs, ledger and subscriptions, and is run after the
-- new backend is deployed.

-- ── Plans ────────────────────────────────────────────────────────────────
do $$
declare
  v_name text;
begin
  -- The code list and the "free counts requests, paid counts cost" rule, whatever
  -- Postgres named them.
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
  check (code in ('free', 'starter', 'builder', 'pro', 'enterprise'));

alter table public.basecode_plans
  add column if not exists task_limit integer check (task_limit is null or task_limit > 0),
  add column if not exists task_cost_cap_microusd bigint check (
    task_cost_cap_microusd is null or task_cost_cap_microusd > 0
  ),
  add column if not exists pass_budget_microusd bigint check (
    pass_budget_microusd is null or pass_budget_microusd > 0
  );

comment on column public.basecode_plans.task_limit is
  'Tasks a pass includes. For the trial (code free) it is a lifetime count. Null is unlimited.';
comment on column public.basecode_plans.task_cost_cap_microusd is
  'Provider cost one task may reach before its next model call is refused. Null is uncapped.';
comment on column public.basecode_plans.pass_budget_microusd is
  'Provider cost a whole pass may reach. Kept below what the pass nets, so a sale cannot lose money.';

-- weekly_request_limit mirrors task_limit until part 2 drops it: the backend live
-- today still reads it as the fallback for the usage percentage.
insert into public.basecode_plans (
  code, name, price_ngn_minor, price_usd_minor, billing_period_days,
  weekly_request_limit, weekly_budget_microusd,
  task_limit, task_cost_cap_microusd, pass_budget_microusd, model_policy, max_concurrent_turns
) values
  ('free', 'Trial', 0, 0, 30, 5, null, 5, 80000, 250000, 'auto', 1),
  ('starter', 'Starter', 200000, 200, 30, 35, null, 35, 80000, 1000000, 'auto', 1),
  ('builder', 'Builder', 500000, 500, 30, 100, null, 100, 100000, 2500000, 'open_weight', 1),
  ('pro', 'Pro', 1500000, 1500, 30, 60, null, 60, 500000, 7500000, 'frontier', 1),
  ('enterprise', 'Enterprise', null, null, 30, null, null, null, null, null, 'custom', 100)
on conflict (code) do update set
  name = excluded.name,
  price_ngn_minor = excluded.price_ngn_minor,
  price_usd_minor = excluded.price_usd_minor,
  billing_period_days = excluded.billing_period_days,
  weekly_request_limit = excluded.weekly_request_limit,
  weekly_budget_microusd = excluded.weekly_budget_microusd,
  task_limit = excluded.task_limit,
  task_cost_cap_microusd = excluded.task_cost_cap_microusd,
  pass_budget_microusd = excluded.pass_budget_microusd,
  model_policy = excluded.model_policy,
  max_concurrent_turns = excluded.max_concurrent_turns,
  enabled = true,
  updated_at = now();

-- ── A task carries the ceiling it started under ──────────────────────────
-- Copied from the plan at reservation, so retuning a plan never moves the ceiling
-- of a task that is already running.
alter table public.basecode_turn_reservations
  add column if not exists cost_cap_microusd bigint check (
    cost_cap_microusd is null or cost_cap_microusd > 0
  );

-- ── The wallet is over ───────────────────────────────────────────────────
-- Two balances exist, both test grants; no payment was ever recorded. The columns
-- stay until part 2 because the live backend still selects them.
update public.basecode_billing_accounts
set prepaid_balance_microusd = 0, prepaid_updated_at = now()
where prepaid_balance_microusd <> 0;

-- Nothing left open can still be paid for.
update public.basecode_checkout_sessions
set status = 'expired'
where status = 'pending' and expires_at <= now();

-- ── Granting a pass ──────────────────────────────────────────────────────
-- The one place a plan is put on an account. A new pass replaces whatever was
-- there and starts its own allowance; unused tasks do not carry over.
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
  v_starts_at timestamptz := coalesce(p_starts_at, now());
  v_ends_at timestamptz;
begin
  select * into v_plan from public.basecode_plans where code = p_plan_code and enabled;
  if not found or v_plan.code = 'free' then
    raise exception 'basecode_paid_plan_unavailable';
  end if;
  v_ends_at := v_starts_at + make_interval(days => v_plan.billing_period_days);

  update public.basecode_billing_accounts
  set
    plan_code = v_plan.code,
    status = 'active',
    entitlement_starts_at = v_starts_at,
    entitlement_ends_at = v_ends_at,
    cancel_at_period_end = false
  where id = p_account_id;
  if not found then raise exception 'basecode_account_missing'; end if;

  return v_ends_at;
end;
$$;

-- ── Starting a task ──────────────────────────────────────────────────────
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
  v_plan_code text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_reset_at timestamptz;
  v_active_count integer;
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

  v_plan_code := public.basecode_effective_plan(v_account);
  select * into v_plan from public.basecode_plans where code = v_plan_code and enabled;
  if not found then
    raise exception 'basecode_plan_unavailable';
  end if;

  -- The allowance belongs to the pass, so its period is the pass's own dates. The
  -- trial has no dates: it is one period that opens with the account and never
  -- turns over, which is what makes it once-only.
  if v_plan.code = 'free' then
    v_starts_at := v_account.created_at;
    v_ends_at := v_account.created_at + interval '100 years';
    v_reset_at := null;
  else
    v_starts_at := coalesce(v_account.entitlement_starts_at, v_account.created_at);
    v_ends_at := v_account.entitlement_ends_at;
    v_reset_at := v_ends_at;
  end if;

  insert into public.basecode_usage_periods(
    account_id, plan_code, starts_at, ends_at, request_limit, budget_microusd
  ) values (
    v_account.id, v_plan.code, v_starts_at, v_ends_at, v_plan.task_limit, v_plan.pass_budget_microusd
  )
  on conflict (account_id, plan_code, starts_at) do update set
    request_limit = excluded.request_limit,
    budget_microusd = excluded.budget_microusd,
    ends_at = excluded.ends_at,
    updated_at = now()
  returning * into v_period;

  select count(*) into v_active_count
  from public.basecode_turn_reservations
  where account_id = v_account.id
    and status in ('reserved', 'running')
    and expires_at > now();

  if v_active_count >= v_plan.max_concurrent_turns then
    return jsonb_build_object(
      'allowed', false, 'reason', 'concurrency_limit',
      'plan', v_plan.code, 'reset_at', v_reset_at
    );
  end if;

  if v_plan.task_limit is not null and v_period.requests_used >= v_plan.task_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', case when v_plan.code = 'free' then 'trial_limit' else 'task_limit' end,
      'plan', v_plan.code,
      'percentage_used', 100,
      'tasks_used', v_period.requests_used,
      'tasks_limit', v_plan.task_limit,
      'reset_at', v_reset_at
    );
  end if;

  if v_period.budget_microusd is not null and v_period.cost_used_microusd >= v_period.budget_microusd then
    return jsonb_build_object(
      'allowed', false, 'reason', 'pass_budget_limit',
      'plan', v_plan.code,
      'percentage_used', 100,
      'tasks_used', v_period.requests_used,
      'tasks_limit', v_plan.task_limit,
      'reset_at', v_reset_at
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
      when v_plan.task_limit is null then 0
      else least(100, round(100.0 * v_period.requests_used / v_plan.task_limit))
    end,
    'tasks_used', v_period.requests_used,
    'tasks_limit', v_plan.task_limit,
    'task_cost_cap_microusd', v_plan.task_cost_cap_microusd,
    'reset_at', v_reset_at
  );
end;
$$;

-- ── Each model call inside a task ────────────────────────────────────────
-- A task that has reached its ceiling gets no further model calls. The call that
-- crosses the line is allowed to finish, so the overshoot is at most one call.
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
  v_reset_at := case when v_plan.code = 'free' then null else v_period.ends_at end;

  if v_reservation.cost_cap_microusd is not null
    and v_reservation.actual_cost_microusd >= v_reservation.cost_cap_microusd then
    return jsonb_build_object(
      'allowed', false, 'reason', 'task_cost_limit',
      'plan', v_plan.code, 'reset_at', v_reset_at
    );
  end if;

  if v_period.budget_microusd is not null and v_period.cost_used_microusd >= v_period.budget_microusd then
    return jsonb_build_object(
      'allowed', false, 'reason', 'pass_budget_limit',
      'plan', v_plan.code, 'reset_at', v_reset_at
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

-- ── What a model call cost ───────────────────────────────────────────────
create or replace function public.basecode_record_gateway_usage(
  p_user_id uuid,
  p_gateway_request_id text,
  p_cost_microusd bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_reservation public.basecode_turn_reservations%rowtype;
  v_inserted bigint;
begin
  if p_user_id is null or nullif(trim(p_gateway_request_id), '') is null or p_cost_microusd < 0 then
    return false;
  end if;

  select id into v_account_id
  from public.basecode_billing_accounts
  where user_id = p_user_id;
  if v_account_id is null then return false; end if;

  -- The usage of a call is recorded after the answer has streamed, by which time a
  -- short task may already have closed. It still belongs to that task, so the
  -- newest one is taken whether or not it is still open.
  select * into v_reservation
  from public.basecode_turn_reservations
  where account_id = v_account_id
    and created_at > now() - interval '2 hours'
    and status in ('reserved', 'running', 'completed', 'released')
  order by (status in ('reserved', 'running')) desc, created_at desc
  limit 1
  for update;
  if not found then return false; end if;

  insert into public.basecode_usage_events(
    account_id, usage_period_id, reservation_id, kind, cost_delta_microusd, gateway_request_id
  ) values (
    v_account_id, v_reservation.usage_period_id, v_reservation.id,
    'gateway_usage', p_cost_microusd, left(trim(p_gateway_request_id), 200)
  )
  on conflict (gateway_request_id) where gateway_request_id is not null do nothing
  returning id into v_inserted;

  if v_inserted is null then return true; end if;

  update public.basecode_usage_periods
  set cost_used_microusd = cost_used_microusd + p_cost_microusd
  where id = v_reservation.usage_period_id;

  update public.basecode_turn_reservations
  set status = case when status = 'reserved' then 'running' else status end,
      actual_cost_microusd = actual_cost_microusd + p_cost_microusd,
      gateway_calls = gateway_calls + 1
  where id = v_reservation.id;

  return true;
end;
$$;

-- ── Ending a task ────────────────────────────────────────────────────────
-- A task that never reached a model gives its place back.
create or replace function public.basecode_finish_turn(
  p_user_id uuid,
  p_client_turn_key uuid,
  p_runtime_turn_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_reservation public.basecode_turn_reservations%rowtype;
begin
  select id into v_account_id
  from public.basecode_billing_accounts
  where user_id = p_user_id;
  if v_account_id is null then return false; end if;

  select * into v_reservation
  from public.basecode_turn_reservations
  where account_id = v_account_id and client_turn_key = p_client_turn_key
  for update;
  if not found then return false; end if;
  if v_reservation.status in ('completed', 'released', 'expired') then return true; end if;

  if v_reservation.gateway_calls = 0 then
    update public.basecode_usage_periods
    set requests_used = greatest(requests_used - 1, 0)
    where id = v_reservation.usage_period_id;

    insert into public.basecode_usage_events(
      account_id, usage_period_id, reservation_id, kind, request_delta, cost_delta_microusd
    ) values (
      v_account_id, v_reservation.usage_period_id, v_reservation.id, 'release', -1, 0
    );
  end if;

  update public.basecode_turn_reservations
  set
    runtime_turn_id = nullif(left(coalesce(p_runtime_turn_id, ''), 200), ''),
    status = case when gateway_calls = 0 then 'released' else 'completed' end,
    reserved_microusd = 0,
    completed_at = now()
  where id = v_reservation.id;

  return true;
end;
$$;

-- ── A verified payment buys a pass ───────────────────────────────────────
-- Shared by both entry points below. The backend live today routes a pack purchase
-- to basecode_apply_prepaid_payment and a plan purchase to
-- basecode_apply_verified_payment; from here on they do the same thing.
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
  v_plan_code text;
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

  -- A pack checkout written by the live backend names the plan in pack_code, and
  -- for Starter its plan_code says free.
  v_plan_code := coalesce(v_checkout.pack_code, v_checkout.plan_code);
  if v_plan_code not in ('starter', 'builder', 'pro') then
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

  -- The 30 days run from when the pass is granted, not from when the money moved,
  -- so a late webhook never shortens what was paid for.
  v_ends_at := public.basecode_grant_pass(v_checkout.account_id, v_plan_code, v_starts_at);

  update public.basecode_checkout_sessions
  set status = 'paid', paid_at = v_paid_at
  where id = v_checkout.id;

  return jsonb_build_object(
    'applied', true,
    'account_id', v_checkout.account_id,
    'plan', v_plan_code,
    'pack', v_plan_code,
    'period_start', v_starts_at,
    'period_end', v_ends_at,
    'credited_microusd', 0,
    'balance_microusd', 0
  );
end;
$$;

create or replace function public.basecode_apply_verified_payment(
  p_checkout_session_id uuid,
  p_provider_transaction_id text,
  p_amount_minor bigint,
  p_currency text,
  p_payment_method text,
  p_paid_at timestamptz,
  p_provider_payload jsonb default '{}'::jsonb
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.basecode_apply_pass_payment(
    p_checkout_session_id, p_provider_transaction_id, p_amount_minor,
    p_currency, p_payment_method, p_paid_at, p_provider_payload
  );
$$;

create or replace function public.basecode_apply_prepaid_payment(
  p_checkout_session_id uuid,
  p_provider_transaction_id text,
  p_amount_minor bigint,
  p_currency text,
  p_payment_method text,
  p_paid_at timestamptz,
  p_provider_payload jsonb default '{}'::jsonb
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.basecode_apply_pass_payment(
    p_checkout_session_id, p_provider_transaction_id, p_amount_minor,
    p_currency, p_payment_method, p_paid_at, p_provider_payload
  );
$$;

revoke all on function public.basecode_grant_pass(uuid, text, timestamptz) from public;
revoke all on function public.basecode_apply_pass_payment(uuid, text, bigint, text, text, timestamptz, jsonb) from public;
grant execute on function public.basecode_grant_pass(uuid, text, timestamptz) to service_role;
grant execute on function public.basecode_apply_pass_payment(uuid, text, bigint, text, text, timestamptz, jsonb) to service_role;

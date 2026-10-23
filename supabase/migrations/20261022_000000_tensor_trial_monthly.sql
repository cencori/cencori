-- The trial refreshes every month (2026-10-22).
--
-- Until now the trial was five tasks, ever: one usage period opened with the account
-- and ran for a hundred years. It is now the same five tasks, refilled each month on
-- the day the account was created, so every tier has a date its allowance resets on.
--
-- Periods are anchored to the account's creation, not to the calendar month, so no
-- account gets a short first month. An account still inside its first month keeps
-- its current period: the new one starts at the same instant, so the reservation
-- below matches the existing row and only shortens its end from a hundred years to
-- one month. Older accounts open a fresh period, with all five tasks, on their next
-- reservation.
--
-- The pass tiers are unchanged: a pass is still one allowance for its 30 days.

-- ── The trial's current month ───────────────────────────────────────────
-- The month-long window, counted from the account's creation, that contains p_at.
-- Postgres clamps month arithmetic (Jan 31 + 1 month is Feb 28), so the count from
-- age() is checked against the real boundaries rather than trusted.
create or replace function public.basecode_trial_period(
  p_created_at timestamptz,
  p_at timestamptz default now()
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
set search_path = public
as $$
declare
  v_age interval := age(p_at, p_created_at);
  v_months integer := greatest(
    0,
    (extract(year from v_age) * 12 + extract(month from v_age))::integer
  );
begin
  if p_created_at > p_at then
    v_months := 0;
  end if;
  while v_months > 0 and p_created_at + make_interval(months => v_months) > p_at loop
    v_months := v_months - 1;
  end loop;
  while p_created_at + make_interval(months => v_months + 1) <= p_at loop
    v_months := v_months + 1;
  end loop;
  starts_at := p_created_at + make_interval(months => v_months);
  ends_at := p_created_at + make_interval(months => v_months + 1);
  return next;
end;
$$;

revoke all on function public.basecode_trial_period(timestamptz, timestamptz) from public;
grant execute on function public.basecode_trial_period(timestamptz, timestamptz) to service_role;

comment on column public.basecode_plans.task_limit is
  'Tasks a pass includes. For the trial (code free) it is a monthly count. Null is unlimited.';

-- ── Reserving a task ─────────────────────────────────────────────────────
-- As before, except that the trial's period is the current month.
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
    select starts_at, ends_at into v_starts_at, v_ends_at
    from public.basecode_trial_period(v_account.created_at);
    v_reset_at := v_ends_at;
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
-- As before, except that the trial now has a reset to report.
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
  -- A task opened under last month's trial period may still be running; its period is the one
  -- that ends, so that end is the reset to report.
  v_reset_at := v_period.ends_at;

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

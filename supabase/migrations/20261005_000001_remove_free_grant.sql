-- Tensor: remove the free grant.
--
-- The `free` plan code stays (foreign keys and the effective-plan fallback
-- reference it), but it no longer grants any usage: every request-counted
-- turn must hold wallet credit, exactly like paid overage already did. No
-- wallet balance means `insufficient_credits` on the very first turn.
--
-- Starter packs keep `grants_plan = 'free'` — those buyers stay on the auto
-- model policy and burn wallet from turn one. Nothing else changes:
-- builder/pro velocity caps, holds, refunds, and the ledger are untouched.

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
  v_week_start timestamptz;
  v_week_end timestamptz;
  v_active_count integer;
  v_reserve_microusd bigint := 1000;
  v_needs_wallet boolean := false;
  v_new_balance bigint;
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
      'status', v_existing.status,
      'reset_at', (select ends_at from public.basecode_usage_periods where id = v_existing.usage_period_id)
    );
  end if;

  v_plan_code := public.basecode_effective_plan(v_account);
  select * into v_plan from public.basecode_plans where code = v_plan_code and enabled;
  if not found then
    raise exception 'basecode_plan_unavailable';
  end if;

  select starts_at, ends_at into v_week_start, v_week_end
  from public.basecode_week_bounds(now());

  insert into public.basecode_usage_periods(
    account_id, plan_code, starts_at, ends_at, request_limit, budget_microusd
  ) values (
    v_account.id, v_plan.code, v_week_start, v_week_end,
    v_plan.weekly_request_limit, v_plan.weekly_budget_microusd
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
      'plan', v_plan.code, 'reset_at', v_period.ends_at
    );
  end if;

  -- No free grant: request-counted (free) turns burn wallet credit from the
  -- first turn. The request counter keeps incrementing for accounting, but
  -- admission is purely wallet-gated with a hard stop at zero.
  if v_plan.weekly_request_limit is not null then
    if v_account.prepaid_balance_microusd < v_reserve_microusd then
      return jsonb_build_object(
        'allowed', false, 'reason', 'insufficient_credits',
        'plan', v_plan.code, 'percentage_used', 100, 'reset_at', v_period.ends_at
      );
    end if;
    v_needs_wallet := true;
    update public.basecode_usage_periods
    set requests_used = requests_used + 1
    where id = v_period.id
    returning * into v_period;
  else
    -- Cost-weighted (builder/pro): weekly velocity cap still applies, plus wallet.
    if v_period.cost_used_microusd + v_period.cost_reserved_microusd >= v_plan.weekly_budget_microusd then
      return jsonb_build_object(
        'allowed', false, 'reason', 'weekly_budget_limit',
        'plan', v_plan.code, 'percentage_used', 100, 'reset_at', v_period.ends_at
      );
    end if;
    if v_account.prepaid_balance_microusd < v_reserve_microusd then
      return jsonb_build_object(
        'allowed', false, 'reason', 'insufficient_credits',
        'plan', v_plan.code, 'percentage_used', 100, 'reset_at', v_period.ends_at
      );
    end if;
    v_needs_wallet := true;
    v_reserve_microusd := least(
      v_reserve_microusd,
      greatest(v_plan.weekly_budget_microusd - v_period.cost_used_microusd - v_period.cost_reserved_microusd, 0)
    );
    update public.basecode_usage_periods
    set cost_reserved_microusd = cost_reserved_microusd + v_reserve_microusd
    where id = v_period.id
    returning * into v_period;
  end if;

  if v_needs_wallet and v_reserve_microusd > 0 then
    v_new_balance := v_account.prepaid_balance_microusd - v_reserve_microusd;
    update public.basecode_billing_accounts
    set prepaid_balance_microusd = v_new_balance, prepaid_updated_at = now(), updated_at = now()
    where id = v_account.id;
    insert into public.basecode_prepaid_ledger(
      account_id, kind, amount_microusd, balance_after_microusd, metadata
    ) values (
      v_account.id, 'burn', -v_reserve_microusd, v_new_balance,
      jsonb_build_object('reason', 'reserve', 'client_turn_key', p_client_turn_key)
    );
  end if;

  insert into public.basecode_turn_reservations(
    account_id, usage_period_id, client_turn_key, model, reserved_microusd, expires_at
  ) values (
    v_account.id, v_period.id, p_client_turn_key,
    nullif(left(coalesce(p_model, ''), 160), ''),
    v_reserve_microusd, now() + interval '2 hours'
  ) returning * into v_reservation;

  insert into public.basecode_usage_events(
    account_id, usage_period_id, reservation_id, kind, request_delta, cost_delta_microusd
  ) values (
    v_account.id, v_period.id, v_reservation.id, 'reserve',
    case when v_plan.weekly_request_limit is null then 0 else 1 end,
    v_reserve_microusd
  );

  return jsonb_build_object(
    'allowed', true,
    'reservation_id', v_reservation.id,
    'plan', v_plan.code,
    'model_policy', v_plan.model_policy,
    'percentage_used', case
      when v_period.request_limit is not null then
        least(100, round(100.0 * v_period.requests_used / v_period.request_limit))
      when v_period.budget_microusd is not null then
        least(100, round(100.0 * (v_period.cost_used_microusd + v_period.cost_reserved_microusd) / v_period.budget_microusd))
      else 0
    end,
    'reset_at', v_period.ends_at,
    'prepaid_balance_microusd', case when v_needs_wallet then (v_account.prepaid_balance_microusd - v_reserve_microusd) else v_account.prepaid_balance_microusd end
  );
end;
$$;

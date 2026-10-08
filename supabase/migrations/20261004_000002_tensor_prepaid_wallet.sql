-- Tensor prepaid wallet (2026-10-04).
--
-- Cash-first model: customer cash lands before any provider cost is burned.
-- Packs credit a persistent microUSD wallet; every turn burns actual provider
-- cost from the wallet with a hard stop at zero. Weekly buckets remain as
-- velocity caps (anti-spike + provider-float pacing), the wallet caps total
-- liability so no upfront provider prefunding is needed.
--
-- Packs (margin baked into exchange rate, ~45-55% at sale after fees):
--   starter ₦2,000 / $2.00  -> $0.60 credit, stays on free/auto (overage wallet)
--   builder ₦5,000 / $5.00  -> $1.70 credit, unlocks builder/open_weight
--   pro     ₦15,000 / $15.00 -> $5.50 credit, unlocks pro/frontier
--
-- Pack purchase never downgrades plan (free->builder->pro only). No expiry in
-- v1; breakage comes from fees + margin. Expiry can be added later via the
-- ledger expires_at column without changing the burn path.

-- ── Packs ────────────────────────────────────────────────────────────────
create table if not exists public.basecode_prepaid_packs (
  code text primary key check (code in ('starter', 'builder', 'pro')),
  name text not null,
  price_ngn_minor bigint not null check (price_ngn_minor > 0),
  price_usd_minor bigint not null check (price_usd_minor > 0),
  credit_microusd bigint not null check (credit_microusd > 0),
  grants_plan text not null check (grants_plan in ('free', 'builder', 'pro')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.basecode_prepaid_packs (code, name, price_ngn_minor, price_usd_minor, credit_microusd, grants_plan) values
  ('starter', 'Starter', 200000, 200, 600000, 'free'),
  ('builder', 'Builder', 500000, 500, 1700000, 'builder'),
  ('pro', 'Pro', 1500000, 1500, 5500000, 'pro')
on conflict (code) do update set
  name = excluded.name,
  price_ngn_minor = excluded.price_ngn_minor,
  price_usd_minor = excluded.price_usd_minor,
  credit_microusd = excluded.credit_microusd,
  grants_plan = excluded.grants_plan,
  enabled = excluded.enabled,
  updated_at = now();

-- ── Wallet columns ───────────────────────────────────────────────────────
alter table public.basecode_billing_accounts
  add column if not exists prepaid_balance_microusd bigint not null default 0 check (prepaid_balance_microusd >= 0),
  add column if not exists prepaid_total_credited_microusd bigint not null default 0 check (prepaid_total_credited_microusd >= 0),
  add column if not exists prepaid_updated_at timestamptz;

-- ── Checkout linkage ─────────────────────────────────────────────────────
-- pack_code set for prepaid purchases; legacy subscription checkouts leave it null.
alter table public.basecode_checkout_sessions
  add column if not exists pack_code text references public.basecode_prepaid_packs(code),
  add column if not exists purchase_kind text not null default 'subscription' check (purchase_kind in ('subscription', 'prepaid'));

-- ── Ledger ───────────────────────────────────────────────────────────────
create table if not exists public.basecode_prepaid_ledger (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.basecode_billing_accounts(id) on delete cascade,
  kind text not null check (kind in ('purchase', 'burn', 'refund')),
  amount_microusd bigint not null check (amount_microusd <> 0),
  balance_after_microusd bigint not null check (balance_after_microusd >= 0),
  checkout_session_id uuid references public.basecode_checkout_sessions(id) on delete set null,
  gateway_request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists basecode_prepaid_ledger_account_created_idx
  on public.basecode_prepaid_ledger(account_id, created_at desc);
create unique index if not exists basecode_prepaid_ledger_gateway_request_uidx
  on public.basecode_prepaid_ledger(gateway_request_id)
  where gateway_request_id is not null;

-- ── Apply verified prepaid payment ───────────────────────────────────────
-- Idempotent via checkout status (pending->paid). Credits the wallet, records
-- the ledger, and unlocks the picker plan without ever downgrading.
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkout public.basecode_checkout_sessions%rowtype;
  v_pack public.basecode_prepaid_packs%rowtype;
  v_account public.basecode_billing_accounts%rowtype;
  v_new_balance bigint;
  v_new_total bigint;
  v_granted_plan text;
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
  if v_checkout.purchase_kind <> 'prepaid' then raise exception 'basecode_checkout_not_prepaid'; end if;
  if v_checkout.pack_code is null then raise exception 'basecode_pack_missing'; end if;
  if v_checkout.expires_at <= coalesce(p_paid_at, now()) then raise exception 'basecode_checkout_expired'; end if;
  if p_amount_minor < v_checkout.expected_amount_minor then raise exception 'basecode_payment_underpaid'; end if;
  if upper(p_currency) <> v_checkout.currency then raise exception 'basecode_payment_currency_mismatch'; end if;
  if nullif(trim(p_provider_transaction_id), '') is null then raise exception 'basecode_payment_id_missing'; end if;

  select * into v_pack from public.basecode_prepaid_packs where code = v_checkout.pack_code and enabled;
  if not found then raise exception 'basecode_pack_unavailable'; end if;

  select * into v_account from public.basecode_billing_accounts where id = v_checkout.account_id for update;
  if not found then raise exception 'basecode_account_missing'; end if;

  insert into public.basecode_payments(
    account_id, checkout_session_id, provider, provider_transaction_id,
    reference, amount_minor, currency, status, payment_method, provider_payload, paid_at
  ) values (
    v_checkout.account_id, v_checkout.id, v_checkout.provider,
    left(trim(p_provider_transaction_id), 200), v_checkout.reference,
    p_amount_minor, upper(p_currency), 'successful',
    nullif(left(coalesce(p_payment_method, ''), 100), ''),
    coalesce(p_provider_payload, '{}'::jsonb),
    coalesce(p_paid_at, now())
  )
  on conflict (provider, provider_transaction_id) do nothing;
  -- A conflicting payment row means this provider transaction already applied.
  -- Mark the checkout paid without double-crediting the wallet.
  if not found then
    update public.basecode_checkout_sessions set status = 'paid', paid_at = coalesce(p_paid_at, now())
    where id = v_checkout.id;
    return jsonb_build_object('applied', false, 'duplicate', true, 'account_id', v_checkout.account_id);
  end if;

  v_new_balance := v_account.prepaid_balance_microusd + v_pack.credit_microusd;
  v_new_total := v_account.prepaid_total_credited_microusd + v_pack.credit_microusd;

  -- Unlock the picker on purchase, never downgrade: free->builder->pro.
  v_granted_plan := v_account.plan_code;
  if v_pack.grants_plan = 'pro' then
    v_granted_plan := 'pro';
  elsif v_pack.grants_plan = 'builder' and v_account.plan_code = 'free' then
    v_granted_plan := 'builder';
  end if;

  update public.basecode_billing_accounts
  set prepaid_balance_microusd = v_new_balance,
      prepaid_total_credited_microusd = v_new_total,
      prepaid_updated_at = now(),
      plan_code = v_granted_plan,
      status = 'active',
      updated_at = now()
  where id = v_account.id;

  insert into public.basecode_prepaid_ledger(
    account_id, kind, amount_microusd, balance_after_microusd,
    checkout_session_id, metadata
  ) values (
    v_account.id, 'purchase', v_pack.credit_microusd, v_new_balance,
    v_checkout.id,
    jsonb_build_object('pack_code', v_pack.code, 'grants_plan', v_pack.grants_plan)
  );

  update public.basecode_checkout_sessions
  set status = 'paid', paid_at = coalesce(p_paid_at, now())
  where id = v_checkout.id;

  return jsonb_build_object(
    'applied', true,
    'account_id', v_checkout.account_id,
    'pack', v_pack.code,
    'plan', v_granted_plan,
    'credited_microusd', v_pack.credit_microusd,
    'balance_microusd', v_new_balance
  );
end;
$$;

-- ── Burn path: reserve holds $0.001 (1000 micro) from the wallet ──────────
-- Free accounts within their request limit behave exactly as before (no wallet
-- movement). Free accounts past the limit, and all paid accounts, must hold
-- wallet balance to be admitted. The hold is refunded on finish-without-usage
-- and settled against actual cost on record_gateway_usage.

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

  -- Request-counted (free) plan: within limit behaves as before with no wallet
  -- movement. Past the limit, a wallet hold admits the turn as paid overage.
  if v_plan.weekly_request_limit is not null then
    if v_period.requests_used < v_plan.weekly_request_limit then
      update public.basecode_usage_periods
      set requests_used = requests_used + 1
      where id = v_period.id
      returning * into v_period;
      v_reserve_microusd := 0;
    else
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
    end if;
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
  v_account public.basecode_billing_accounts%rowtype;
  v_reservation public.basecode_turn_reservations%rowtype;
  v_inserted bigint;
  v_hold bigint;
  v_delta bigint;
  v_new_balance bigint;
begin
  if p_user_id is null or nullif(trim(p_gateway_request_id), '') is null or p_cost_microusd < 0 then
    return false;
  end if;

  select * into v_account
  from public.basecode_billing_accounts
  where user_id = p_user_id
  for update;
  if not found then return false; end if;

  select * into v_reservation
  from public.basecode_turn_reservations
  where account_id = v_account.id
    and status in ('reserved', 'running')
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;
  if not found then return false; end if;

  insert into public.basecode_usage_events(
    account_id, usage_period_id, reservation_id, kind, cost_delta_microusd, gateway_request_id
  ) values (
    v_account.id, v_reservation.usage_period_id, v_reservation.id,
    'gateway_usage', p_cost_microusd, left(trim(p_gateway_request_id), 200)
  )
  on conflict (gateway_request_id) where gateway_request_id is not null do nothing
  returning id into v_inserted;

  if v_inserted is null then return true; end if;

  v_hold := coalesce(v_reservation.reserved_microusd, 0);
  -- Settle the hold against actual cost: refund the $0.001 hold, charge actual.
  -- Reservations with no hold (free within limit) move no wallet money.
  v_delta := p_cost_microusd - v_hold;
  if v_hold > 0 or p_cost_microusd > 0 then
    if v_delta > v_account.prepaid_balance_microusd then
      -- Do not drive the wallet negative: burn what remains and keep serving
      -- this already-completed turn rather than failing post-hoc. The next
      -- reserve is denied at zero, which is the hard stop.
      v_delta := v_account.prepaid_balance_microusd;
    end if;
    if v_delta <> 0 then
      v_new_balance := v_account.prepaid_balance_microusd - v_delta;
      update public.basecode_billing_accounts
      set prepaid_balance_microusd = v_new_balance, prepaid_updated_at = now(), updated_at = now()
      where id = v_account.id;
      insert into public.basecode_prepaid_ledger(
        account_id, kind, amount_microusd, balance_after_microusd, gateway_request_id, metadata
      ) values (
        v_account.id, 'burn', -v_delta, v_new_balance,
        left(trim(p_gateway_request_id), 200),
        jsonb_build_object('hold_microusd', v_hold, 'actual_microusd', p_cost_microusd)
      );
    end if;
  end if;

  update public.basecode_usage_periods
  set
    cost_used_microusd = cost_used_microusd + p_cost_microusd,
    cost_reserved_microusd = greatest(cost_reserved_microusd - v_hold, 0)
  where id = v_reservation.usage_period_id;

  update public.basecode_turn_reservations
  set status = 'running',
      actual_cost_microusd = actual_cost_microusd + p_cost_microusd,
      gateway_calls = gateway_calls + 1,
      reserved_microusd = 0
  where id = v_reservation.id;

  return true;
end;
$$;

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
  v_hold bigint;
  v_new_balance bigint;
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

  v_hold := coalesce(v_reservation.reserved_microusd, 0);
  if v_reservation.gateway_calls = 0 then
    update public.basecode_usage_periods
    set
      requests_used = greatest(requests_used - case when v_hold = 0 then 1 else 0 end, 0),
      cost_reserved_microusd = greatest(cost_reserved_microusd - v_hold, 0)
    where id = v_reservation.usage_period_id;

    insert into public.basecode_usage_events(
      account_id, usage_period_id, reservation_id, kind, request_delta, cost_delta_microusd
    ) values (
      v_account_id, v_reservation.usage_period_id, v_reservation.id, 'release',
      case when v_hold = 0 then -1 else 0 end, -v_hold
    );

    -- Refund the wallet hold for turns that never reached an upstream model.
    if v_hold > 0 then
      update public.basecode_billing_accounts
      set prepaid_balance_microusd = prepaid_balance_microusd + v_hold,
          prepaid_updated_at = now(), updated_at = now()
      where id = v_account_id
      returning prepaid_balance_microusd into v_new_balance;
      insert into public.basecode_prepaid_ledger(
        account_id, kind, amount_microusd, balance_after_microusd, metadata
      ) values (
        v_account_id, 'refund', v_hold, v_new_balance,
        jsonb_build_object('reason', 'release', 'client_turn_key', p_client_turn_key)
      );
    end if;
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

-- Hard stop at zero also applies between reserve and dispatch.
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

  if v_period.budget_microusd is not null
    and v_period.cost_used_microusd >= v_period.budget_microusd then
    return jsonb_build_object(
      'allowed', false, 'reason', 'weekly_budget_limit',
      'plan', v_plan.code, 'reset_at', v_period.ends_at
    );
  end if;

  -- Prepaid hard stop: a paid turn holds wallet; free overage holds wallet.
  -- Free turns inside the request limit hold nothing and pass freely.
  if v_reservation.reserved_microusd > 0 and v_account.prepaid_balance_microusd < 0 then
    return jsonb_build_object(
      'allowed', false, 'reason', 'insufficient_credits',
      'plan', v_plan.code, 'reset_at', v_period.ends_at
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reservation_id', v_reservation.id,
    'plan', v_plan.code,
    'model_policy', v_plan.model_policy,
    'reset_at', v_period.ends_at
  );
end;
$$;

alter table public.basecode_prepaid_packs enable row level security;
alter table public.basecode_prepaid_ledger enable row level security;

revoke all on table public.basecode_prepaid_packs from anon, authenticated;
revoke all on table public.basecode_prepaid_ledger from anon, authenticated;
revoke all on function public.basecode_apply_prepaid_payment(uuid, text, bigint, text, text, timestamptz, jsonb) from public;
grant execute on function public.basecode_apply_prepaid_payment(uuid, text, bigint, text, text, timestamptz, jsonb) to service_role;

comment on table public.basecode_prepaid_packs is
  'Prepaid inference packs. Cash lands before provider cost burns; margin is baked into the price-to-credit rate.';
comment on table public.basecode_prepaid_ledger is
  'Append-only wallet ledger. Purchases credit, burns debit, releases refund. Never rewrite history.';

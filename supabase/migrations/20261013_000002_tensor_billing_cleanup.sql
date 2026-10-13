-- Tensor billing rebuild, part 2 of 2 (2026-10-13).
--
-- Run this only after the backend that sells passes is deployed. Part 1 left the
-- wallet, packs and subscriptions in place because the backend live at the time
-- still read them; nothing reads them now, and this removes them.
--
-- It also gives every account that exists today 30 days of Starter. They are the
-- testers, and until now they were on a plan that was named Starter and cost
-- nothing. It is done here rather than in part 1 so that nobody is on `starter`
-- while a backend that does not know the code is still answering.

-- ── Testers: 30 days of Starter ──────────────────────────────────────────
do $$
declare
  v_account record;
begin
  for v_account in
    select id from public.basecode_billing_accounts
    where public.basecode_effective_plan(basecode_billing_accounts) = 'free'
  loop
    perform public.basecode_grant_pass(v_account.id, 'starter', now());
  end loop;
end;
$$;

-- ── A checkout names its plan, and only its plan ─────────────────────────
-- A Starter checkout written before the new backend says free in plan_code and
-- starter in pack_code. Carry the real plan across before the column goes.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'basecode_checkout_sessions'
      and column_name = 'pack_code'
  ) then
    update public.basecode_checkout_sessions
    set plan_code = pack_code
    where pack_code is not null and plan_code <> pack_code;
  end if;
end;
$$;

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
    entitlement_ends_at = v_ends_at
  where id = p_account_id;
  if not found then raise exception 'basecode_account_missing'; end if;

  return v_ends_at;
end;
$$;

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
  if v_checkout.plan_code not in ('starter', 'builder', 'pro') then
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

-- ── What the rebuild replaced ────────────────────────────────────────────
drop function if exists public.basecode_apply_prepaid_payment(uuid, text, bigint, text, text, timestamptz, jsonb);
drop function if exists public.basecode_apply_subscription_renewal(uuid, text, text, text, text, bigint, text, text, timestamptz, jsonb);
drop function if exists public.basecode_week_bounds(timestamptz);

alter table public.basecode_checkout_sessions
  drop column if exists pack_code,
  drop column if exists purchase_kind;

drop table if exists public.basecode_prepaid_ledger;
drop table if exists public.basecode_prepaid_packs;
-- Nothing renews, so there is no subscription to keep and no saved customer to charge.
drop table if exists public.basecode_subscriptions;
drop table if exists public.basecode_billing_customers;

alter table public.basecode_billing_accounts
  drop column if exists prepaid_balance_microusd,
  drop column if exists prepaid_total_credited_microusd,
  drop column if exists prepaid_updated_at,
  drop column if exists cancel_at_period_end;

alter table public.basecode_plans
  drop column if exists weekly_request_limit,
  drop column if exists weekly_budget_microusd;

comment on table public.basecode_plans is
  'Tensor passes. A pass is a number of tasks over billing_period_days; a task and the pass each have a cost ceiling. The code free is the once-only trial.';

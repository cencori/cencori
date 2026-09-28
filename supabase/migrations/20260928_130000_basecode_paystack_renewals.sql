-- Paystack auto-renew for Basecode plans.
--
-- 1. `provider_subscription_token` holds Paystack's email_token, which is required
--    alongside the subscription code to disable a subscription (opt out).
-- 2. `basecode_apply_subscription_renewal` extends the current period atomically
--    when a Paystack renewal charge verifies. Renewals arrive without a checkout
--    reference (Paystack generates its own), so they cannot reuse
--    `basecode_apply_verified_payment`, which is checkout-bound.

alter table public.basecode_subscriptions
  add column if not exists provider_subscription_token text;

create or replace function public.basecode_apply_subscription_renewal(
  p_account_id uuid,
  p_plan_code text,
  p_provider text,
  p_provider_subscription_id text,
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
  v_plan public.basecode_plans%rowtype;
  v_subscription public.basecode_subscriptions%rowtype;
  v_checkout_id uuid;
  v_period_start timestamptz := coalesce(p_paid_at, now());
  v_period_end timestamptz;
begin
  if p_account_id is null
    or nullif(trim(p_provider_transaction_id), '') is null
    or p_amount_minor is null
    or p_amount_minor <= 0
  then
    raise exception 'basecode_renewal_invalid';
  end if;

  select * into v_plan from public.basecode_plans where code = p_plan_code and enabled;
  if not found or v_plan.code in ('free', 'enterprise') then
    raise exception 'basecode_paid_plan_unavailable';
  end if;

  -- The renewal extends whichever subscription row is current for this account and
  -- plan — typically the row the first payment created, with the provider
  -- subscription id backfilled onto it. A renewal arriving before the
  -- subscription.create webhook simply attaches the linkage itself.
  select * into v_subscription
  from public.basecode_subscriptions
  where account_id = p_account_id
    and plan_code = p_plan_code
    and status in ('active', 'past_due', 'paused')
  order by current_period_end desc
  limit 1
  for update;

  if not found then
    raise exception 'basecode_subscription_not_found';
  end if;

  -- Renewals stack onto the live period rather than the charge timestamp, so a
  -- late-arriving webhook never shortens access already granted.
  v_period_end := greatest(v_subscription.current_period_end, v_period_start)
    + make_interval(days => v_plan.billing_period_days);

  -- basecode_payments.checkout_session_id references basecode_checkout_sessions,
  -- which a provider-generated renewal has none of. Reuse the account's latest
  -- checkout for the same plan as the audit anchor.
  select id into v_checkout_id
  from public.basecode_checkout_sessions
  where account_id = p_account_id and plan_code = p_plan_code
  order by created_at desc
  limit 1;
  if v_checkout_id is null then
    raise exception 'basecode_checkout_not_found';
  end if;

  insert into public.basecode_payments(
    account_id,
    checkout_session_id,
    provider,
    provider_transaction_id,
    reference,
    amount_minor,
    currency,
    status,
    payment_method,
    provider_payload,
    paid_at
  ) values (
    p_account_id,
    v_checkout_id,
    p_provider,
    left(trim(p_provider_transaction_id), 200),
    -- No checkout reference exists for renewals; anchor the uniqueness to the
    -- provider transaction instead.
    left(trim(p_provider_transaction_id), 200),
    p_amount_minor,
    upper(p_currency),
    'successful',
    nullif(left(coalesce(p_payment_method, ''), 100), ''),
    coalesce(p_provider_payload, '{}'::jsonb),
    v_period_start
  )
  on conflict (provider, provider_transaction_id) do nothing;

  if not found then
    return jsonb_build_object('applied', false, 'duplicate', true, 'account_id', p_account_id);
  end if;

  update public.basecode_subscriptions
  set
    provider_subscription_id = coalesce(provider_subscription_id, nullif(trim(p_provider_subscription_id), '')),
    status = 'active',
    current_period_end = v_period_end,
    auto_renews = true,
    cancel_at_period_end = false
  where id = v_subscription.id;

  update public.basecode_billing_accounts
  set
    plan_code = p_plan_code,
    status = 'active',
    entitlement_ends_at = v_period_end,
    cancel_at_period_end = false
  where id = p_account_id;

  return jsonb_build_object(
    'applied', true,
    'account_id', p_account_id,
    'plan', p_plan_code,
    'period_start', v_period_start,
    'period_end', v_period_end
  );
end;
$$;

revoke all on function public.basecode_apply_subscription_renewal(uuid, text, text, text, text, bigint, text, text, timestamptz, jsonb) from public;
grant execute on function public.basecode_apply_subscription_renewal(uuid, text, text, text, text, bigint, text, text, timestamptz, jsonb) to service_role;

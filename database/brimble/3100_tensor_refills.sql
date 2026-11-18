-- Refills: a paid plan that has used its week can buy the week again (2026-11-18).
--
-- A refill is paid for once, through Bachs, and gives back the whole of the week's allowance:
-- what the week has cost so far is forgiven (cost_reset_microusd, as an admin reset is), so the
-- account starts the week's share of the ceiling over. What it cost stays on the period for the
-- books, and the refill row says how much it forgave and which period.
--
-- It is priced above the plan's own weekly share (lib/tensor-refills.ts), so it always earns
-- more than the model calls it lets through, and buying it often costs more than the next plan.
-- A refill lasts the week it was bought in; nothing is carried on.

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
  -- Once paid: the week it refilled, and how much of that week's cost it forgave.
  usage_period_id uuid references public.basecode_usage_periods(id) on delete set null,
  forgiven_microusd bigint check (forgiven_microusd is null or forgiven_microusd >= 0),
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

-- Applies a verified payment to its refill, once. The amount has been checked against the
-- refill's price by the caller (lib/tensor-refills.ts); this makes the grant and the record one
-- step, and a second delivery of the same payment a no-op.
create or replace function public.tensor_apply_refill(
  p_refill_id uuid,
  p_transaction_id text,
  p_amount_minor bigint,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refill public.tensor_refills%rowtype;
  v_allowance record;
  v_period public.basecode_usage_periods%rowtype;
  v_forgiven bigint;
begin
  select * into v_refill from public.tensor_refills where id = p_refill_id for update;
  if not found then
    raise exception 'tensor_refill_missing';
  end if;
  if v_refill.status = 'paid' then
    return jsonb_build_object('applied', false, 'already', true, 'refill_id', v_refill.id);
  end if;

  -- The week the account is in now, made if no turn has made it yet (as basecode_reserve_turn does).
  select * into v_allowance from public.basecode_allowance_period(v_refill.account_id);
  insert into public.basecode_usage_periods(
    account_id, plan_code, starts_at, ends_at, request_limit, budget_microusd
  ) values (
    v_refill.account_id, v_allowance.plan_code, v_allowance.starts_at, v_allowance.ends_at,
    null, v_allowance.budget_microusd
  )
  on conflict (account_id, plan_code, starts_at) do update set
    budget_microusd = excluded.budget_microusd,
    ends_at = excluded.ends_at,
    updated_at = now()
  returning * into v_period;

  select * into v_period from public.basecode_usage_periods where id = v_period.id for update;
  v_forgiven := greatest(v_period.cost_used_microusd - v_period.cost_reset_microusd, 0);

  update public.basecode_usage_periods
  set cost_reset_microusd = cost_reset_microusd + v_forgiven,
      updated_at = now()
  where id = v_period.id;

  update public.tensor_refills
  set status = 'paid',
      paid_at = now(),
      provider_transaction_id = p_transaction_id,
      paid_amount_minor = p_amount_minor,
      paid_currency = p_currency,
      usage_period_id = v_period.id,
      forgiven_microusd = v_forgiven
  where id = v_refill.id;

  return jsonb_build_object(
    'applied', true,
    'refill_id', v_refill.id,
    'usage_period_id', v_period.id,
    'forgiven_microusd', v_forgiven
  );
end;
$$;

revoke all on function public.tensor_apply_refill(uuid, text, bigint, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.tensor_apply_refill(uuid, text, bigint, text) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.tensor_apply_refill(uuid, text, bigint, text) to service_role;
  end if;
end $$;

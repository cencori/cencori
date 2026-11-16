-- Plain chats: talking with Tensor outside any project.
--
-- A project's chat lives in its sandbox (tensor_cloud_chats holds only the runtime's thread id).
-- A plain chat has no sandbox: it is answered by a model call straight through Cencori, so its
-- messages are kept here.
--
-- And a turn of it is billed by what it costs, not as a task. A task is a whole piece of work in
-- a sandbox; a chat message is one model call. Counting each message as a task would spend
-- Starter's week in nine messages. So a reservation can now be a chat turn
-- (basecode_chat_reservations): it checks and spends the plan's cost ceiling for the month (the
-- trial's included) and leaves the task count alone.
--
-- Nothing here alters an existing table, so it never waits behind a backup.
--
-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts. The live build does not
-- read the new tables, and calls basecode_reserve_turn with three named arguments, which the new
-- four-argument version (its fourth defaulted) still answers, as a task.

create table if not exists public.tensor_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text,
  -- The project a chat was turned into, once it has been. The chat stays where it was.
  project_task_id uuid references public.tensor_cloud_tasks(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tensor_chats_user_idx
  on public.tensor_chats (user_id, updated_at desc);

create table if not exists public.tensor_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.tensor_chats(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- An answer that was cut short says so, and is kept as far as it got.
  status text not null default 'complete' check (status in ('complete', 'stopped', 'failed')),
  model text,
  created_at timestamptz not null default now()
);

create index if not exists tensor_chat_messages_chat_idx
  on public.tensor_chat_messages (chat_id, created_at);

-- Reached only by the server, with the service role. A browser never reads these tables.
alter table public.tensor_chats enable row level security;
alter table public.tensor_chat_messages enable row level security;
revoke all on table public.tensor_chats from anon, authenticated;
revoke all on table public.tensor_chat_messages from anon, authenticated;
grant all on table public.tensor_chats to service_role;
grant all on table public.tensor_chat_messages to service_role;

comment on table public.tensor_chats is
  'Plain Tensor chats on the web: conversations outside any project, with no sandbox.';
comment on table public.tensor_chat_messages is
  'The messages of plain Tensor chats, in order.';

-- ── Which reservations are chat turns ──────────────────────────────────
-- Kept beside basecode_turn_reservations rather than as a column of it. Adding a column needs an
-- exclusive lock on that table, which waits behind the database's backups (pg_dump holds a share
-- lock on every table for as long as it runs) and failed two deploys on 2026-11-16. A new table
-- needs no lock on anything a backup holds.
create table if not exists public.basecode_chat_reservations (
  reservation_id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.basecode_chat_reservations enable row level security;
revoke all on table public.basecode_chat_reservations from anon, authenticated;
grant all on table public.basecode_chat_reservations to service_role;

comment on table public.basecode_chat_reservations is
  'Turn reservations that are one message of a plain chat: billed only by cost against the month''s ceiling, never counted as a task.';

-- ── Reserving a turn ─────────────────────────────────────────────────────
-- As in 0900, with p_kind. A chat turn skips the task count (neither checked nor spent) and is
-- capped at a few cents, so one message can never take much of a small plan's month.
drop function if exists public.basecode_reserve_turn(uuid, uuid, text);

create or replace function public.basecode_reserve_turn(
  p_user_id uuid,
  p_client_turn_key uuid,
  p_model text default null,
  p_kind text default 'task'
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
  v_chat boolean := coalesce(p_kind, 'task') = 'chat';
  -- One chat message's ceiling: five cents, or the plan's own per-task cap when that is lower.
  v_chat_cap bigint := 50000;
begin
  if p_user_id is null or p_client_turn_key is null
    or coalesce(p_kind, 'task') not in ('task', 'chat') then
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

  if not v_chat
    and v_allowance.task_limit is not null
    and v_period.requests_used >= v_allowance.task_limit then
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

  if not v_chat then
    update public.basecode_usage_periods
    set requests_used = requests_used + 1
    where id = v_period.id
    returning * into v_period;
  end if;

  insert into public.basecode_turn_reservations(
    account_id, usage_period_id, client_turn_key, model,
    reserved_microusd, cost_cap_microusd, expires_at
  ) values (
    v_account.id, v_period.id, p_client_turn_key,
    nullif(left(coalesce(p_model, ''), 160), ''),
    0,
    case
      when v_chat then least(v_chat_cap, coalesce(v_plan.task_cost_cap_microusd, v_chat_cap))
      else v_plan.task_cost_cap_microusd
    end,
    now() + case when v_chat then interval '10 minutes' else interval '2 hours' end
  ) returning * into v_reservation;

  if v_chat then
    insert into public.basecode_chat_reservations(reservation_id) values (v_reservation.id);
  end if;

  insert into public.basecode_usage_events(
    account_id, usage_period_id, reservation_id, kind, request_delta, cost_delta_microusd
  ) values (
    v_account.id, v_period.id, v_reservation.id, 'reserve', case when v_chat then 0 else 1 end, 0
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
    'task_cost_cap_microusd', v_reservation.cost_cap_microusd,
    'reset_at', v_allowance.ends_at
  );
end;
$$;

revoke all on function public.basecode_reserve_turn(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.basecode_reserve_turn(uuid, uuid, text, text) to service_role;

-- ── Finishing a turn ─────────────────────────────────────────────────────
-- As in 20261013_000001, except that a chat turn that made no call has no task to give back.
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

  if v_reservation.gateway_calls = 0 and not exists (
    select 1 from public.basecode_chat_reservations where reservation_id = v_reservation.id
  ) then
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

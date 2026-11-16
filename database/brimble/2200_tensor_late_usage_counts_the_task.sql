-- A task whose model calls are recorded after it closed is counted as a task after all.
--
-- A call's cost is recorded once its answer has streamed, so a short task can close first. Closing
-- a task that has no recorded call gives its place back (basecode_finish_turn: status released,
-- requests_used - 1). The late cost then arrived and was counted against the month's ceiling, but
-- the task stayed given back: a quick task could go uncounted against the week's tasks.
--
-- Now a call recorded against a task that was given back takes the place again: requests_used + 1,
-- logged as an adjustment, and the task is marked completed. A chat turn
-- (basecode_chat_reservations) never held a place, so it is left as it is.
--
-- Replaces only the function: no table is altered, so this never waits behind a backup.

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

  -- A task given back for having made no call has made one: it counts again.
  if v_reservation.status = 'released'
    and not exists (
      select 1 from public.basecode_chat_reservations where reservation_id = v_reservation.id
    ) then
    update public.basecode_usage_periods
    set requests_used = requests_used + 1
    where id = v_reservation.usage_period_id;

    insert into public.basecode_usage_events(
      account_id, usage_period_id, reservation_id, kind, request_delta, cost_delta_microusd
    ) values (
      v_account_id, v_reservation.usage_period_id, v_reservation.id, 'adjustment', 1, 0
    );
  end if;

  update public.basecode_turn_reservations
  set status = case
        when status = 'reserved' then 'running'
        when status = 'released' then 'completed'
        else status
      end,
      actual_cost_microusd = actual_cost_microusd + p_cost_microusd,
      gateway_calls = gateway_calls + 1
  where id = v_reservation.id;

  return true;
end;
$$;

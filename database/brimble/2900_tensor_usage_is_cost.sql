-- Tensor usage is measured in cost alone (2026-11-18).
--
-- An account had two meters: tasks counted in a week, and provider cost summed across the
-- month. They disagreed in plain sight -- an account showing 0 of 9 tasks could be shut out
-- until next month because its cost ceiling was gone, and clearing the week did nothing for it.
--
-- Now there is one. The month's ceiling is cut into weeks, each getting the share of it that
-- its days are of the month, and an account is used up for the week when that week's cost
-- reaches its share:
--
--              a month    a week of a 30-day month
--   starter     $1.00       $0.23
--   builder     $2.50       $0.58
--   pro         $7.50       $1.75
--   max        $11.00       $2.57
--   ultra      $57.00      $13.30
--
-- Weeks are still counted from the moment the month started. The days left over after the
-- last whole week (two, in a 30-day month) join that week rather than standing alone, so
-- no window is too small to do anything in; it gets their share of the ceiling too. What
-- a week leaves unspent is not carried on, so a month never costs more than its ceiling.
--
-- Tasks are still counted, as a figure to look at, and no longer limit anything. The trial is
-- its month's ceiling and nothing else. Max and Ultra, which were one ceiling for the whole
-- month, are weekly like the rest.
--
-- A reset from the internal page forgives the week's cost instead of zeroing a task count.
-- What was spent stays on the period (cost_used_microusd) for the books; cost_reset_microusd
-- is how much of it no longer counts against the week.
--
-- A pass bought before weeks existed keeps its one period for the whole pass, measured
-- against the whole ceiling.
--
-- Safe against the backend that is live while this is applied: it reads task_limit as null
-- and shows the month's cost until the new backend is serving.

alter table public.basecode_usage_periods
  add column if not exists cost_reset_microusd bigint not null default 0
  check (cost_reset_microusd >= 0);

comment on column public.basecode_usage_periods.cost_reset_microusd is
  'How much of cost_used_microusd an admin reset has forgiven. The period''s usage is the difference.';
comment on column public.basecode_usage_periods.budget_microusd is
  'Provider cost this period may reach: the share of the month''s ceiling that its days are.';
comment on column public.basecode_plans.task_limit is
  'No longer a limit (2900): usage is measured in cost. Kept for the record of what plans once allowed.';
comment on column public.basecode_plans.pass_budget_microusd is
  'Provider cost a month of the plan may reach. Each week gets the share its days are of the month. Null is no ceiling.';

-- The trial was held by its task count. Without a ceiling it would now be held by nothing.
update public.basecode_plans
set pass_budget_microusd = 250000
where code = 'free' and pass_budget_microusd is null;

-- ── The allowance an account is in ───────────────────────────────────────
-- Dropped first because what it returns has changed.
drop function if exists public.basecode_allowance_period(uuid, timestamptz);

create function public.basecode_allowance_period(
  p_account_id uuid,
  p_at timestamptz default now()
)
returns table (
  plan_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  -- Always null. Kept so callers written against the task count read "no limit".
  task_limit integer,
  pass_ends_at timestamptz,
  pass_cost_used_microusd bigint,
  model_policy text,
  -- What this period may cost, and what it has, less anything a reset forgave.
  budget_microusd bigint,
  cost_used_microusd bigint
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
  v_month_seconds numeric;
  v_months integer;
  v_month integer;
  v_weeks integer;
  v_last_week integer;
  v_starts_at timestamptz;
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
  task_limit := null;
  model_policy := v_plan.model_policy;
  budget_microusd := v_plan.pass_budget_microusd;

  if v_plan.code = 'free' then
    -- The trial's month is one period, with the whole of its ceiling.
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

    -- A pass bought before weeks existed has one period as long as the pass.
    select * into v_legacy
    from public.basecode_usage_periods p
    where p.account_id = v_account.id
      and p.plan_code = v_plan.code
      and p.starts_at = v_paid_from
      and p.ends_at > v_paid_from + interval '13 days';

    if found and v_month = 0 then
      starts_at := v_paid_from;
      ends_at := pass_ends_at;
    else
      v_month_seconds := extract(epoch from (
        coalesce(pass_ends_at, v_month_starts_at + make_interval(days => v_plan.billing_period_days))
        - v_month_starts_at
      ));
      v_weeks := greatest(
        0,
        floor(extract(epoch from (p_at - v_month_starts_at)) / 604800)::integer
      );
      -- The last whole week takes the days left over after it.
      v_last_week := greatest(1, floor(v_month_seconds / 604800)::integer) - 1;
      if pass_ends_at is not null and v_weeks >= v_last_week then
        v_weeks := v_last_week;
        starts_at := v_month_starts_at + make_interval(days => 7 * v_weeks);
        ends_at := pass_ends_at;
      else
        starts_at := v_month_starts_at + make_interval(days => 7 * v_weeks);
        ends_at := starts_at + interval '7 days';
      end if;
      if v_plan.pass_budget_microusd is not null and v_month_seconds > 0 then
        budget_microusd := round(
          v_plan.pass_budget_microusd * extract(epoch from (ends_at - starts_at)) / v_month_seconds
        )::bigint;
      end if;
    end if;
  end if;

  select coalesce(sum(p.cost_used_microusd), 0)::bigint into pass_cost_used_microusd
  from public.basecode_usage_periods p
  where p.account_id = v_account.id
    and p.plan_code = v_plan.code
    and p.starts_at >= v_month_starts_at
    and (pass_ends_at is null or p.starts_at < pass_ends_at);

  -- Under its own name: a bare starts_at below would be read as the column.
  v_starts_at := starts_at;
  select coalesce(max(greatest(p.cost_used_microusd - p.cost_reset_microusd, 0)), 0)::bigint
  into cost_used_microusd
  from public.basecode_usage_periods p
  where p.account_id = v_account.id
    and p.plan_code = v_plan.code
    and p.starts_at = v_starts_at;

  return next;
end;
$$;

revoke all on function public.basecode_allowance_period(uuid, timestamptz) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.basecode_allowance_period(uuid, timestamptz) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.basecode_allowance_period(uuid, timestamptz) to service_role;
  end if;
end $$;

-- ── Reserving a turn ─────────────────────────────────────────────────────
-- As in 2100, held by the week's cost and nothing else. A task is still counted, and a chat
-- turn still is not; neither count refuses anything.
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
  v_used bigint;
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
    null, v_allowance.budget_microusd
  )
  on conflict (account_id, plan_code, starts_at) do update set
    request_limit = excluded.request_limit,
    budget_microusd = excluded.budget_microusd,
    ends_at = excluded.ends_at,
    updated_at = now()
  returning * into v_period;

  v_used := greatest(v_period.cost_used_microusd - v_period.cost_reset_microusd, 0);

  if v_period.budget_microusd is not null and v_used >= v_period.budget_microusd then
    return jsonb_build_object(
      'allowed', false,
      'reason', case when v_plan.code = 'free' then 'trial_limit' else 'pass_budget_limit' end,
      'plan', v_plan.code,
      'percentage_used', 100,
      'reset_at', v_period.ends_at
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
      when v_period.budget_microusd is null or v_period.budget_microusd <= 0 then 0
      else least(100, round(100.0 * v_used / v_period.budget_microusd))
    end,
    'task_cost_cap_microusd', v_reservation.cost_cap_microusd,
    'reset_at', v_period.ends_at
  );
end;
$$;

revoke all on function public.basecode_reserve_turn(uuid, uuid, text, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.basecode_reserve_turn(uuid, uuid, text, text) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.basecode_reserve_turn(uuid, uuid, text, text) to service_role;
  end if;
end $$;

-- ── Each model call inside a task ────────────────────────────────────────
-- As in 0900, against the cost of the period the task was opened in. A task that runs on
-- past its week answers to that week, which is where its cost is recorded.
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

  if v_reservation.cost_cap_microusd is not null
    and v_reservation.actual_cost_microusd >= v_reservation.cost_cap_microusd then
    return jsonb_build_object(
      'allowed', false, 'reason', 'task_cost_limit',
      'plan', v_plan.code, 'reset_at', v_period.ends_at
    );
  end if;

  if v_period.budget_microusd is not null
    and greatest(v_period.cost_used_microusd - v_period.cost_reset_microusd, 0) >= v_period.budget_microusd then
    return jsonb_build_object(
      'allowed', false,
      'reason', case when v_period.plan_code = 'free' then 'trial_limit' else 'pass_budget_limit' end,
      'plan', v_plan.code,
      'reset_at', v_period.ends_at
    );
  end if;

  select * into v_allowance from public.basecode_allowance_period(v_account.id);

  return jsonb_build_object(
    'allowed', true,
    'reservation_id', v_reservation.id,
    'plan', v_plan.code,
    'model_policy', v_allowance.model_policy,
    'reset_at', v_period.ends_at
  );
end;
$$;

-- ── Resets from the internal page ────────────────────────────────────────
-- As in 2400, forgiving the week's cost. The task count is left as it is: it limits nothing.
create or replace function public.basecode_admin_reset_week(
  p_user_id uuid,
  p_admin_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.basecode_billing_accounts%rowtype;
  v_allowance record;
  v_period public.basecode_usage_periods%rowtype;
  v_cleared bigint := 0;
begin
  if p_user_id is null or coalesce(trim(p_admin_email), '') = '' then
    raise exception 'invalid_basecode_admin_action';
  end if;

  select * into v_account
  from public.basecode_billing_accounts
  where user_id = p_user_id
  for update;
  if not found then
    raise exception 'basecode_account_missing';
  end if;

  select * into v_allowance from public.basecode_allowance_period(v_account.id);

  select * into v_period
  from public.basecode_usage_periods p
  where p.account_id = v_account.id
    and p.plan_code = v_allowance.plan_code
    and p.starts_at = v_allowance.starts_at
  for update;

  if found and v_period.cost_used_microusd > v_period.cost_reset_microusd then
    v_cleared := v_period.cost_used_microusd - v_period.cost_reset_microusd;
    update public.basecode_usage_periods
    set cost_reset_microusd = cost_used_microusd
    where id = v_period.id;
    insert into public.basecode_usage_events(
      account_id, usage_period_id, kind, request_delta, cost_delta_microusd, metadata
    ) values (
      v_account.id, v_period.id, 'adjustment', 0, 0,
      jsonb_build_object(
        'reason', 'admin_reset_week', 'admin', p_admin_email, 'cost_cleared_microusd', v_cleared
      )
    );
  end if;

  insert into public.basecode_admin_actions(admin_email, action, account_id, detail)
  values (
    p_admin_email, 'reset_week', v_account.id,
    jsonb_build_object('plan', v_allowance.plan_code, 'cost_cleared_microusd', v_cleared)
  );

  return jsonb_build_object(
    'plan', v_allowance.plan_code,
    'cost_cleared_microusd', v_cleared,
    'reset_at', v_allowance.ends_at
  );
end;
$$;

create or replace function public.basecode_admin_reset_week_all(
  p_scope text,
  p_admin_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accounts integer;
  v_cost bigint;
begin
  if p_scope not in ('paid', 'all') or coalesce(trim(p_admin_email), '') = '' then
    raise exception 'invalid_basecode_admin_action';
  end if;

  with running as (
    select p.id, p.account_id, p.cost_used_microusd - p.cost_reset_microusd as cleared
    from public.basecode_usage_periods p
    where p.starts_at <= now()
      and p.ends_at > now()
      and p.cost_used_microusd > p.cost_reset_microusd
      and (p_scope = 'all' or p.plan_code <> 'free')
    for update
  ),
  cleared as (
    update public.basecode_usage_periods p
    set cost_reset_microusd = p.cost_used_microusd
    from running r
    where p.id = r.id
    returning r.id, r.account_id, r.cleared
  ),
  noted as (
    insert into public.basecode_usage_events(
      account_id, usage_period_id, kind, request_delta, cost_delta_microusd, metadata
    )
    select
      c.account_id, c.id, 'adjustment', 0, 0,
      jsonb_build_object(
        'reason', 'admin_reset_week_all', 'admin', p_admin_email, 'cost_cleared_microusd', c.cleared
      )
    from cleared c
    returning 1
  )
  select count(distinct c.account_id)::integer, coalesce(sum(c.cleared), 0)::bigint
  into v_accounts, v_cost
  from cleared c;

  insert into public.basecode_admin_actions(admin_email, action, detail)
  values (
    p_admin_email, 'reset_week_all',
    jsonb_build_object('scope', p_scope, 'accounts', v_accounts, 'cost_cleared_microusd', v_cost)
  );

  return jsonb_build_object('scope', p_scope, 'accounts', v_accounts, 'cost_cleared_microusd', v_cost);
end;
$$;

-- The week an account is in, or nothing for someone who has never opened Tensor.
-- Dropped first because what it returns has changed.
drop function if exists public.basecode_admin_week(uuid);

create function public.basecode_admin_week(p_account_id uuid)
returns table (
  plan_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  budget_microusd bigint,
  cost_used_microusd bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_account_id is null then
    return;
  end if;
  return query
    select al.plan_code, al.starts_at, al.ends_at, al.budget_microusd, al.cost_used_microusd
    from public.basecode_allowance_period(p_account_id) al;
end;
$$;

create or replace function public.basecode_admin_accounts(
  p_query text default null,
  p_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select
      nullif(lower(trim(coalesce(p_query, ''))), '') as term,
      least(greatest(coalesce(p_limit, 20), 1), 50) as max_rows
  ),
  matched as (
    select
      u.id as user_id, u.email, pr.username, a.id as account_id,
      a.entitlement_ends_at, a.updated_at
    from public.auth_users u
    left join public.user_profiles pr on pr.id = u.id
    left join public.basecode_billing_accounts a on a.user_id = u.id
    cross join q
    where case
      when q.term is null then a.id is not null
      else position(q.term in lower(u.email)) > 0
        or position(q.term in lower(coalesce(pr.username, ''))) > 0
    end
    order by a.updated_at desc nulls last, u.email
    limit (select max_rows from q)
  ),
  listed as (
    select
      m.*, al.plan_code, al.ends_at as week_ends_at,
      al.budget_microusd, coalesce(al.cost_used_microusd, 0) as cost_used_microusd
    from matched m
    left join lateral public.basecode_admin_week(m.account_id) al on true
  ),
  running as (
    select p.account_id, p.plan_code
    from public.basecode_usage_periods p
    where p.starts_at <= now() and p.ends_at > now()
      and p.cost_used_microusd > p.cost_reset_microusd
  )
  select jsonb_build_object(
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', l.user_id,
        'email', l.email,
        'username', l.username,
        'plan', coalesce(l.plan_code, 'free'),
        'plan_ends_at', case when l.plan_code is distinct from 'free' then l.entitlement_ends_at end,
        'cost_used_microusd', l.cost_used_microusd,
        'budget_microusd', l.budget_microusd,
        'week_ends_at', l.week_ends_at
      ) order by l.updated_at desc nulls last, l.email)
      from listed l
    ), '[]'::jsonb),
    'in_use', jsonb_build_object(
      'paid', (select count(distinct account_id) from running where plan_code <> 'free'),
      'all', (select count(distinct account_id) from running)
    ),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object('code', pl.code, 'name', pl.name) order by pl.price_usd_minor nulls first)
      from public.basecode_plans pl
      where pl.enabled and pl.code <> 'free' and pl.price_usd_minor is not null
    ), '[]'::jsonb),
    'log', coalesce((
      select jsonb_agg(row order by created_at desc)
      from (
        select
          x.created_at,
          jsonb_build_object(
            'id', x.id, 'at', x.created_at, 'admin', x.admin_email, 'action', x.action,
            'email', u.email, 'detail', x.detail
          ) as row
        from public.basecode_admin_actions x
        left join public.basecode_billing_accounts a on a.id = x.account_id
        left join public.auth_users u on u.id = a.user_id
        order by x.created_at desc
        limit 10
      ) recent
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.basecode_admin_week(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.basecode_admin_week(uuid) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.basecode_admin_week(uuid) to service_role;
  end if;
end $$;

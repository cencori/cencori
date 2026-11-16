-- Resetting a week's tasks and putting a plan on an account, from the internal Tensor page.
--
-- Until now both were done by hand in the database. A reset here clears the tasks counted in
-- the week an account is in and nothing else: the paid month keeps its dates, and the month's
-- cost ceiling keeps what has been spent, so a generous week never costs more than the plan's
-- ceiling already allows. Every action is written down with the admin who took it.

create table if not exists public.basecode_admin_actions (
  id bigint generated always as identity primary key,
  admin_email text not null,
  action text not null check (action in ('reset_week', 'reset_week_all', 'set_plan')),
  account_id uuid references public.basecode_billing_accounts(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists basecode_admin_actions_created_idx
  on public.basecode_admin_actions(created_at desc);

alter table public.basecode_admin_actions enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.basecode_admin_actions from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on table public.basecode_admin_actions to service_role;
  end if;
end $$;

-- ── One account's week ───────────────────────────────────────────────────
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
  v_cleared integer := 0;
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

  if found and v_period.requests_used > 0 then
    v_cleared := v_period.requests_used;
    update public.basecode_usage_periods set requests_used = 0 where id = v_period.id;
    insert into public.basecode_usage_events(
      account_id, usage_period_id, kind, request_delta, cost_delta_microusd, metadata
    ) values (
      v_account.id, v_period.id, 'adjustment', -v_cleared, 0,
      jsonb_build_object('reason', 'admin_reset_week', 'admin', p_admin_email)
    );
  end if;

  insert into public.basecode_admin_actions(admin_email, action, account_id, detail)
  values (
    p_admin_email, 'reset_week', v_account.id,
    jsonb_build_object('plan', v_allowance.plan_code, 'tasks_cleared', v_cleared)
  );

  return jsonb_build_object(
    'plan', v_allowance.plan_code,
    'tasks_cleared', v_cleared,
    'reset_at', v_allowance.ends_at
  );
end;
$$;

-- ── Everyone's week ──────────────────────────────────────────────────────
-- p_scope 'paid' leaves the free trial alone; 'all' includes it.
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
  v_tasks bigint;
begin
  if p_scope not in ('paid', 'all') or coalesce(trim(p_admin_email), '') = '' then
    raise exception 'invalid_basecode_admin_action';
  end if;

  with running as (
    select p.id, p.account_id, p.requests_used
    from public.basecode_usage_periods p
    where p.starts_at <= now()
      and p.ends_at > now()
      and p.requests_used > 0
      and (p_scope = 'all' or p.plan_code <> 'free')
    for update
  ),
  cleared as (
    update public.basecode_usage_periods p
    set requests_used = 0
    from running r
    where p.id = r.id
    returning r.id, r.account_id, r.requests_used
  ),
  noted as (
    insert into public.basecode_usage_events(
      account_id, usage_period_id, kind, request_delta, cost_delta_microusd, metadata
    )
    select
      c.account_id, c.id, 'adjustment', -c.requests_used, 0,
      jsonb_build_object('reason', 'admin_reset_week_all', 'admin', p_admin_email)
    from cleared c
    returning 1
  )
  select count(distinct c.account_id)::integer, coalesce(sum(c.requests_used), 0)::bigint
  into v_accounts, v_tasks
  from cleared c;

  insert into public.basecode_admin_actions(admin_email, action, detail)
  values (
    p_admin_email, 'reset_week_all',
    jsonb_build_object('scope', p_scope, 'accounts', v_accounts, 'tasks_cleared', v_tasks)
  );

  return jsonb_build_object('scope', p_scope, 'accounts', v_accounts, 'tasks_cleared', v_tasks);
end;
$$;

-- ── A plan on an account ─────────────────────────────────────────────────
-- A month of a paid plan starting now. As with a payment, an account already on that plan
-- gets the month added to its end instead.
create or replace function public.basecode_admin_set_plan(
  p_user_id uuid,
  p_plan_code text,
  p_admin_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_before text;
  v_ends_at timestamptz;
begin
  if p_user_id is null or coalesce(trim(p_admin_email), '') = '' then
    raise exception 'invalid_basecode_admin_action';
  end if;

  insert into public.basecode_billing_accounts(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select a.id, public.basecode_effective_plan(a) into v_account_id, v_before
  from public.basecode_billing_accounts a
  where a.user_id = p_user_id;

  v_ends_at := public.basecode_grant_pass(v_account_id, p_plan_code, now());

  insert into public.basecode_admin_actions(admin_email, action, account_id, detail)
  values (
    p_admin_email, 'set_plan', v_account_id,
    jsonb_build_object('plan', p_plan_code, 'from', v_before, 'ends_at', v_ends_at)
  );

  return jsonb_build_object('plan', p_plan_code, 'from', v_before, 'ends_at', v_ends_at);
end;
$$;

-- The week an account is in, or nothing for someone who has never opened Tensor and so has no
-- account to ask about.
create or replace function public.basecode_admin_week(p_account_id uuid)
returns table (plan_code text, task_limit integer, starts_at timestamptz, ends_at timestamptz)
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
    select al.plan_code, al.task_limit, al.starts_at, al.ends_at
    from public.basecode_allowance_period(p_account_id) al;
end;
$$;

-- ── What the page shows ──────────────────────────────────────────────────
-- Accounts matching an email or username (the most recently used when nothing is asked for),
-- how many accounts a reset of everyone would touch, and the last actions taken.
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
      m.*, al.plan_code, al.task_limit, al.ends_at as week_ends_at,
      coalesce(p.requests_used, 0) as tasks_used
    from matched m
    left join lateral public.basecode_admin_week(m.account_id) al on true
    left join public.basecode_usage_periods p
      on p.account_id = m.account_id
      and p.plan_code = al.plan_code
      and p.starts_at = al.starts_at
  ),
  running as (
    select p.account_id, p.plan_code
    from public.basecode_usage_periods p
    where p.starts_at <= now() and p.ends_at > now() and p.requests_used > 0
  )
  select jsonb_build_object(
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', l.user_id,
        'email', l.email,
        'username', l.username,
        'plan', coalesce(l.plan_code, 'free'),
        'plan_ends_at', case when l.plan_code is distinct from 'free' then l.entitlement_ends_at end,
        'tasks_used', l.tasks_used,
        'tasks_limit', l.task_limit,
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

revoke all on function public.basecode_admin_reset_week(uuid, text) from public;
revoke all on function public.basecode_admin_reset_week_all(text, text) from public;
revoke all on function public.basecode_admin_set_plan(uuid, text, text) from public;
revoke all on function public.basecode_admin_accounts(text, integer) from public;
revoke all on function public.basecode_admin_week(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.basecode_admin_reset_week(uuid, text) from anon, authenticated;
    revoke all on function public.basecode_admin_reset_week_all(text, text) from anon, authenticated;
    revoke all on function public.basecode_admin_set_plan(uuid, text, text) from anon, authenticated;
    revoke all on function public.basecode_admin_accounts(text, integer) from anon, authenticated;
    revoke all on function public.basecode_admin_week(uuid) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.basecode_admin_reset_week(uuid, text) to service_role;
    grant execute on function public.basecode_admin_reset_week_all(text, text) to service_role;
    grant execute on function public.basecode_admin_set_plan(uuid, text, text) to service_role;
    grant execute on function public.basecode_admin_accounts(text, integer) to service_role;
    grant execute on function public.basecode_admin_week(uuid) to service_role;
  end if;
end $$;

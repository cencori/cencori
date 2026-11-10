-- Tensor's launch numbers for the internal Tensor page (2026-11-10): who signed up, who ran a
-- task, who paid, and what the tasks cost to run. Everything is read from what Tensor already
-- records to bill and sync accounts; nothing new is collected, and no message text is read.
--
-- A task is a turn reservation: every task the app starts reserves one, whatever device it ran
-- on, so it is the one count that cannot miss a task.
--
-- A naira payment is valued in dollars at its plan's own two prices (a ₦2,000 Starter month is
-- $2), which is what it would have brought in had it been paid in dollars; a payment whose plan
-- is unknown is valued at ₦1,000 to the dollar, the ratio the first three plans are priced at.
--
-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts. Read only: it takes no
-- lock on the tables it reads, and running it again only replaces the function.

create or replace function public.analytics_tensor_series(p_start timestamptz, p_bucket interval)
returns jsonb
language sql
stable
set search_path = public
set timezone = 'UTC'
as $$
    with first_seen as (
        select least(
            coalesce((select min(created_at) from public.basecode_billing_accounts), now()),
            coalesce((select min(created_at) from public.basecode_turn_reservations), now())
        ) as at
    ),
    bounds as (
        select
            date_bin(p_bucket, greatest(p_start, (select at from first_seen)), timestamptz '2000-01-01') as lo,
            date_bin(p_bucket, now(), timestamptz '2000-01-01') as hi
    ),
    buckets as (
        select generate_series(lo, hi, p_bucket) as t from bounds
    ),
    -- Every successful payment, with the plan it paid for and its worth in dollars.
    paid as (
        select
            p.account_id,
            p.paid_at,
            p.currency,
            p.amount_minor,
            plan.code as plan_code,
            case
                when p.currency = 'USD' then p.amount_minor / 100.0
                when plan.price_ngn_minor > 0 and plan.price_usd_minor > 0
                    then p.amount_minor::numeric / plan.price_ngn_minor * plan.price_usd_minor / 100.0
                else p.amount_minor / 100.0 / 1000.0
            end as usd
        from public.basecode_payments p
        left join public.basecode_checkout_sessions c on c.id = p.checkout_session_id
        left join lateral (
            select plan_code from public.basecode_subscriptions
            where account_id = p.account_id order by updated_at desc limit 1
        ) s on true
        left join public.basecode_billing_accounts a on a.id = p.account_id
        left join public.basecode_plans plan on plan.code = coalesce(c.plan_code, s.plan_code, a.plan_code)
        where p.status = 'successful' and p.paid_at is not null
    ),
    tasks as (
        select
            r.account_id,
            r.created_at,
            r.status,
            r.model,
            coalesce(r.actual_cost_microusd, 0) / 1000000.0 as cost_usd,
            u.plan_code
        from public.basecode_turn_reservations r
        left join public.basecode_usage_periods u on u.id = r.usage_period_id
    ),
    first_task as (
        select account_id, min(created_at) as at from tasks group by account_id
    ),
    first_paid as (
        select account_id, min(paid_at) as at from paid group by account_id
    ),
    signup_buckets as (
        select date_bin(p_bucket, created_at, timestamptz '2000-01-01') as t, count(*) as signups
        from public.basecode_billing_accounts where created_at >= p_start group by 1
    ),
    activation_buckets as (
        select date_bin(p_bucket, at, timestamptz '2000-01-01') as t, count(*) as activated
        from first_task where at >= p_start group by 1
    ),
    task_buckets as (
        select
            date_bin(p_bucket, created_at, timestamptz '2000-01-01') as t,
            count(*) as tasks,
            count(distinct account_id) as active,
            coalesce(sum(cost_usd), 0) as cost
        from tasks where created_at >= p_start group by 1
    ),
    paid_buckets as (
        select
            date_bin(p_bucket, paid_at, timestamptz '2000-01-01') as t,
            count(*) as payments,
            coalesce(sum(usd), 0) as revenue,
            coalesce(sum(usd) filter (where currency = 'USD'), 0) as usd,
            coalesce(sum(usd) filter (where currency = 'NGN'), 0) as ngn_usd
        from paid where paid_at >= p_start group by 1
    ),
    new_payer_buckets as (
        select date_bin(p_bucket, at, timestamptz '2000-01-01') as t, count(*) as new_payers
        from first_paid where at >= p_start group by 1
    ),
    -- Accounts on a paid plan today, and the dollars a month each is worth.
    paying_now as (
        select a.id, a.plan_code, plan.name, plan.price_usd_minor / 100.0 as monthly_usd
        from public.basecode_billing_accounts a
        join public.basecode_plans plan on plan.code = a.plan_code
        where a.plan_code <> 'free' and a.status = 'active' and a.entitlement_ends_at > now()
    ),
    -- The allowance each account is in right now.
    current_period as (
        select distinct on (u.account_id) u.account_id, u.plan_code, u.request_limit, u.requests_used
        from public.basecode_usage_periods u
        where u.starts_at <= now() and u.ends_at > now()
        order by u.account_id, u.starts_at desc
    ),
    plan_rows as (
        select
            plan.code,
            plan.name,
            (select count(*) from paying_now n where n.plan_code = plan.code) as accounts,
            coalesce((select sum(usd) from paid where paid.plan_code = plan.code and paid_at >= p_start), 0) as revenue,
            coalesce((select sum(cost_usd) from tasks where tasks.plan_code = plan.code and created_at >= p_start), 0) as cost,
            (select count(*) from tasks where tasks.plan_code = plan.code and created_at >= p_start) as tasks
        from public.basecode_plans plan
    )
    select jsonb_build_object(
        'series', coalesce((
            select jsonb_agg(jsonb_build_object(
                't', (extract(epoch from b.t) * 1000)::bigint,
                'signups', coalesce(s.signups, 0),
                'activated', coalesce(v.activated, 0),
                'tasks', coalesce(k.tasks, 0),
                'active', coalesce(k.active, 0),
                'cost', coalesce(k.cost, 0),
                'payments', coalesce(p.payments, 0),
                'revenue', coalesce(p.revenue, 0),
                'usd', coalesce(p.usd, 0),
                'ngn_usd', coalesce(p.ngn_usd, 0),
                'new_payers', coalesce(n.new_payers, 0)
            ) order by b.t)
            from buckets b
            left join signup_buckets s on s.t = b.t
            left join activation_buckets v on v.t = b.t
            left join task_buckets k on k.t = b.t
            left join paid_buckets p on p.t = b.t
            left join new_payer_buckets n on n.t = b.t
        ), '[]'::jsonb),
        -- What happened inside the period.
        'totals', jsonb_build_object(
            'signups', (select count(*) from public.basecode_billing_accounts where created_at >= p_start),
            -- Of the accounts created in the period, how many have run a task, and how many have paid.
            'signups_activated', (
                select count(*) from public.basecode_billing_accounts a
                where a.created_at >= p_start and exists (select 1 from first_task f where f.account_id = a.id)
            ),
            'signups_paid', (
                select count(*) from public.basecode_billing_accounts a
                where a.created_at >= p_start and exists (select 1 from first_paid f where f.account_id = a.id)
            ),
            'tasks', (select count(*) from tasks where created_at >= p_start),
            'tasks_unfinished', (select count(*) from tasks where created_at >= p_start and status in ('released', 'expired')),
            'active_accounts', (select count(distinct account_id) from tasks where created_at >= p_start),
            'cost', (select coalesce(sum(cost_usd), 0) from tasks where created_at >= p_start),
            'payments', (select count(*) from paid where paid_at >= p_start),
            'revenue', (select coalesce(sum(usd), 0) from paid where paid_at >= p_start),
            'ngn_paid', (select coalesce(sum(amount_minor), 0) / 100.0 from paid where paid_at >= p_start and currency = 'NGN'),
            'usd_paid', (select coalesce(sum(amount_minor), 0) / 100.0 from paid where paid_at >= p_start and currency = 'USD'),
            'paying_accounts', (select count(distinct account_id) from paid where paid_at >= p_start),
            'new_payers', (select count(*) from first_paid where at >= p_start),
            'new_devices', (select count(*) from public.basecode_devices where created_at >= p_start)
        ),
        -- Where things stand now, whatever the period.
        'now', jsonb_build_object(
            'accounts', (select count(*) from public.basecode_billing_accounts),
            'ever_ran_a_task', (select count(*) from first_task),
            'ever_paid', (select count(*) from first_paid),
            'paying', (select count(*) from paying_now),
            'monthly_value', (select coalesce(sum(monthly_usd), 0) from paying_now),
            'renewing', (
                select count(*) from public.basecode_subscriptions
                where status in ('active', 'trialing') and not cancel_at_period_end
            ),
            'cancelling', (
                select count(*) from public.basecode_subscriptions
                where status in ('active', 'trialing') and cancel_at_period_end
            ),
            'past_due', (select count(*) from public.basecode_subscriptions where status in ('past_due', 'unpaid')),
            -- Paid months that run out within a week and will not renew by themselves.
            'ending_soon', (
                select count(*) from paying_now n
                join public.basecode_billing_accounts a on a.id = n.id
                where a.entitlement_ends_at < now() + interval '7 days'
                  and not exists (
                      select 1 from public.basecode_subscriptions s
                      where s.account_id = n.id and s.status in ('active', 'trialing') and not s.cancel_at_period_end
                  )
            ),
            'active_1d', (select count(distinct account_id) from tasks where created_at >= now() - interval '1 day'),
            'active_7d', (select count(distinct account_id) from tasks where created_at >= now() - interval '7 days'),
            'active_30d', (select count(distinct account_id) from tasks where created_at >= now() - interval '30 days'),
            'trial_used_up', (
                select count(*) from current_period
                where plan_code = 'free' and request_limit is not null and requests_used >= request_limit
            ),
            'paid_used_up', (
                select count(*) from current_period
                where plan_code <> 'free' and request_limit is not null and requests_used >= request_limit
            ),
            'devices', (select count(*) from public.basecode_devices),
            'last_task_at', (select max(created_at) from tasks),
            'last_payment_at', (select max(paid_at) from paid)
        ),
        'by_plan', coalesce((
            select jsonb_agg(jsonb_build_object(
                'code', code, 'name', name, 'accounts', accounts,
                'revenue', revenue, 'cost', cost, 'tasks', tasks
            ) order by revenue desc, accounts desc, tasks desc)
            from plan_rows
            where accounts > 0 or revenue > 0 or tasks > 0
        ), '[]'::jsonb),
        'by_model', coalesce((
            select jsonb_agg(jsonb_build_object('name', name, 'value', value, 'cost', cost) order by value desc)
            from (
                select coalesce(nullif(model, ''), 'unknown') as name, count(*) as value, coalesce(sum(cost_usd), 0) as cost
                from tasks where created_at >= p_start group by 1 order by 2 desc limit 10
            ) x
        ), '[]'::jsonb),
        'by_platform', coalesce((
            select jsonb_agg(jsonb_build_object('name', name, 'value', value) order by value desc)
            from (
                select coalesce(nullif(platform, ''), 'unknown') as name, count(*) as value
                from public.basecode_devices group by 1
            ) x
        ), '[]'::jsonb)
    );
$$;

revoke all on function public.analytics_tensor_series(timestamptz, interval) from public;
do $$ begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on function public.analytics_tensor_series(timestamptz, interval) from anon, authenticated;
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        grant execute on function public.analytics_tensor_series(timestamptz, interval) to service_role;
    end if;
end $$;

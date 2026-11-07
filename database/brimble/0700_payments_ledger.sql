-- Cencori's own revenue: one row per successful payment we received.
--
-- Written by the Bachs and CoinCircuit webhooks after a payment is verified
-- (lib/billing/payments-ledger.ts) and backfilled from the Bachs API by
-- POST /api/internal/billing/sync-payments. Read by the internal Revenue page
-- through analytics_revenue_series.
--
-- Not customer-facing money: Stripe Connect (end-user billing) is our
-- customers' revenue and never lands here.
--
-- amount/currency are what the customer paid. amount_usd converts naira at
-- fx_ngn_per_usd, the rate credit packs were sold at when the payment was made
-- (lib/billing/credit-pricing.ts CREDIT_NGN_PER_USD), so a naira payment is
-- worth the dollar credit it bought, not a market-rate estimate.

create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    provider text not null check (provider in ('bachs', 'coincircuit')),
    provider_payment_id text not null,
    organization_id uuid references public.organizations(id) on delete set null,
    product_type text not null,
    product_id text,
    billing_interval text check (billing_interval in ('month', 'year')),
    amount numeric(18, 2) not null check (amount >= 0),
    currency text not null,
    amount_usd numeric(18, 2) not null check (amount_usd >= 0),
    fx_ngn_per_usd numeric(12, 4),
    processing_fee numeric(18, 2),
    settlement_amount numeric(18, 2),
    settlement_currency text,
    payment_method text,
    customer_email text,
    paid_at timestamptz not null,
    created_at timestamptz not null default now(),
    unique (provider, provider_payment_id)
);

create index if not exists idx_payments_paid_at on public.payments (paid_at desc);
create index if not exists idx_payments_organization on public.payments (organization_id, paid_at desc);

-- Service role only. PostgREST's anon/authenticated roles get nothing.
alter table public.payments enable row level security;
revoke all on public.payments from public;
do $$ begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on public.payments from anon, authenticated;
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        grant select, insert, update on public.payments to service_role;
    end if;
end $$;

-- Revenue over time for the internal Revenue page. Same bucketing rules as
-- analytics_platform_series (UTC, series starts at the first payment).
create or replace function public.analytics_revenue_series(p_start timestamptz, p_bucket interval)
returns jsonb
language sql
stable
set search_path = public
set timezone = 'UTC'
as $$
    with bounds as (
        select
            date_bin(
                p_bucket,
                greatest(p_start, coalesce((select min(paid_at) from public.payments), now())),
                timestamptz '2000-01-01'
            ) as lo,
            date_bin(p_bucket, now(), timestamptz '2000-01-01') as hi
    ),
    buckets as (
        select generate_series(lo, hi, p_bucket) as t from bounds
    ),
    windowed as (
        select * from public.payments where paid_at >= p_start
    ),
    per_bucket as (
        select
            date_bin(p_bucket, paid_at, timestamptz '2000-01-01') as t,
            count(*) as payments,
            coalesce(sum(amount_usd), 0) as revenue,
            coalesce(sum(amount_usd) filter (where product_type in ('credits_topup', 'credits_topup_ngn')), 0) as credits,
            coalesce(sum(amount_usd) filter (where product_type = 'subscription'), 0) as subscriptions,
            coalesce(sum(amount_usd) filter (where product_type not in ('credits_topup', 'credits_topup_ngn', 'subscription')), 0) as other,
            coalesce(sum(amount_usd) filter (where currency = 'NGN'), 0) as ngn_usd,
            coalesce(sum(amount_usd) filter (where currency <> 'NGN'), 0) as usd,
            count(distinct organization_id) as paying_orgs
        from windowed
        group by 1
    ),
    -- Monthly recurring revenue: each organization on an active paid plan
    -- counts its latest subscription payment, annual plans divided by 12.
    latest_sub as (
        select distinct on (p.organization_id)
            p.organization_id,
            case when p.billing_interval = 'year' then p.amount_usd / 12 else p.amount_usd end as monthly_usd
        from public.payments p
        join public.organizations o on o.id = p.organization_id
        where p.product_type = 'subscription'
          and o.subscription_status = 'active'
          and coalesce(o.subscription_tier, 'free') <> 'free'
        order by p.organization_id, p.paid_at desc
    )
    select jsonb_build_object(
        'series', (
            select coalesce(jsonb_agg(jsonb_build_object(
                't', (extract(epoch from b.t) * 1000)::bigint,
                'payments', coalesce(r.payments, 0),
                'revenue', coalesce(r.revenue, 0),
                'credits', coalesce(r.credits, 0),
                'subscriptions', coalesce(r.subscriptions, 0),
                'other', coalesce(r.other, 0),
                'ngn_usd', coalesce(r.ngn_usd, 0),
                'usd', coalesce(r.usd, 0),
                'paying_orgs', coalesce(r.paying_orgs, 0)
            ) order by b.t), '[]'::jsonb)
            from buckets b
            left join per_bucket r on r.t = b.t
        ),
        'totals', (
            select jsonb_build_object(
                'payments', count(*),
                'revenue', coalesce(sum(amount_usd), 0),
                'fees', coalesce(sum(case when currency = 'NGN' and fx_ngn_per_usd > 0
                                         then processing_fee / fx_ngn_per_usd
                                         else processing_fee end), 0),
                'ngn_paid', coalesce(sum(amount) filter (where currency = 'NGN'), 0),
                'usd_paid', coalesce(sum(amount) filter (where currency <> 'NGN'), 0),
                'paying_orgs', count(distinct organization_id)
            )
            from windowed
        ),
        'by_product', (
            select coalesce(jsonb_object_agg(product_type, total), '{}'::jsonb)
            from (select product_type, sum(amount_usd) as total from windowed group by 1) x
        ),
        'by_provider', (
            select coalesce(jsonb_object_agg(provider, total), '{}'::jsonb)
            from (select provider, sum(amount_usd) as total from windowed group by 1) x
        ),
        'top_orgs', (
            select coalesce(jsonb_agg(jsonb_build_object('name', name, 'value', total) order by total desc), '[]'::jsonb)
            from (
                select coalesce(o.name, 'Unknown organization') as name, sum(w.amount_usd) as total
                from windowed w
                left join public.organizations o on o.id = w.organization_id
                group by w.organization_id, o.name
                order by 2 desc
                limit 8
            ) x
        ),
        'mrr', (select coalesce(sum(monthly_usd), 0) from latest_sub),
        'active_subscriptions', (select count(*) from latest_sub),
        'last_payment_at', (select max(paid_at) from public.payments)
    );
$$;

revoke all on function public.analytics_revenue_series(timestamptz, interval) from public;
do $$ begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on function public.analytics_revenue_series(timestamptz, interval) from anon, authenticated;
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        grant execute on function public.analytics_revenue_series(timestamptz, interval) to service_role;
    end if;
end $$;

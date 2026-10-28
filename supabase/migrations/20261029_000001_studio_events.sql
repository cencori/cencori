-- Events: a business sells tickets for a party, a show or a dinner from a
-- public page (studio.cencori.com/e/<slug>), paid by card (its own payment
-- provider) or by transfer, with a QR ticket each and check-in at the door.
-- Tickets are rows so seats are counted in the database: 300 people buying
-- at once can't oversell.
create table if not exists public.studio_events (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
    name text not null check (char_length(name) between 1 and 120),
    description text not null default '' check (char_length(description) <= 2000),
    venue text not null default '' check (char_length(venue) <= 200),
    starts_at timestamptz not null,
    ends_at timestamptz,
    currency text not null default 'NGN',
    -- [{ id, name, price, capacity }]: each tier's seats; capacity null means no limit.
    tiers jsonb not null default '[]'::jsonb,
    status text not null default 'live' check (status in ('live', 'closed', 'cancelled')),
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists studio_events_project_idx on public.studio_events (project_id, starts_at desc);

create table if not exists public.studio_tickets (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.studio_events(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    tier_id text not null,
    -- What the QR holds and the door types: short, unambiguous letters and digits.
    code text not null unique,
    -- One purchase (several tickets) shares an order reference and one payment.
    order_ref text not null,
    buyer_name text not null default '',
    buyer_phone text,
    buyer_email text,
    price numeric not null default 0,
    status text not null default 'reserved' check (status in ('reserved', 'paid', 'cancelled')),
    payment_reference text,
    -- A reserved seat is held until then; after, it counts as free again.
    reserved_until timestamptz,
    paid_at timestamptz,
    checked_in_at timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists studio_tickets_event_idx on public.studio_tickets (event_id, tier_id, status);
create index if not exists studio_tickets_order_idx on public.studio_tickets (order_ref);
create index if not exists studio_tickets_payment_idx on public.studio_tickets (payment_reference);

-- Server-only: every read and write goes through the service role.
alter table public.studio_events enable row level security;
alter table public.studio_tickets enable row level security;

-- Reserve tickets in one tier if it has room: paid ones and unexpired
-- reservations count. One statement under a row lock on the event, so two
-- buyers can't both take the last seat. Returns the order reference, or null
-- when there's no room.
create or replace function public.reserve_studio_tickets(
    p_event_id uuid,
    p_tier_id text,
    p_quantity integer,
    p_capacity integer,
    p_price numeric,
    p_order_ref text,
    p_codes text[],
    p_buyer_name text,
    p_buyer_phone text,
    p_buyer_email text,
    p_hold_minutes integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_project uuid;
    v_taken integer;
begin
    select project_id into v_project from public.studio_events where id = p_event_id and status = 'live' for update;
    if v_project is null then return null; end if;
    if p_capacity is not null then
        select count(*) into v_taken from public.studio_tickets
         where event_id = p_event_id and tier_id = p_tier_id
           and (status = 'paid' or (status = 'reserved' and reserved_until > now()));
        if v_taken + p_quantity > p_capacity then return null; end if;
    end if;
    insert into public.studio_tickets (event_id, project_id, tier_id, code, order_ref, buyer_name, buyer_phone, buyer_email, price, status, reserved_until)
    select p_event_id, v_project, p_tier_id, code, p_order_ref, p_buyer_name, p_buyer_phone, p_buyer_email, p_price,
           case when p_price = 0 then 'paid' else 'reserved' end,
           case when p_price = 0 then null else now() + make_interval(mins => p_hold_minutes) end
      from unnest(p_codes[1:p_quantity]) as code;
    if p_price = 0 then update public.studio_tickets set paid_at = now() where order_ref = p_order_ref; end if;
    return p_order_ref;
end;
$$;

revoke all on function public.reserve_studio_tickets(uuid, text, integer, integer, numeric, text, text[], text, text, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_studio_tickets(uuid, text, integer, integer, numeric, text, text[], text, text, text, integer) to service_role;

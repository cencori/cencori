-- Tensor waitlist signups: first-party source of truth.
--
-- The waitlist chat POSTs here on every completed run. The external webhook
-- (Zapier/Make/Sheets) is only a best-effort forward — this table is what
-- counts. One row per email; resubmits refresh the answers in place.

create table if not exists public.tensor_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null constraint tensor_waitlist_email_lowercase
    check (email = lower(email)),
  name text,
  work_email text,
  company text,
  role text,
  building text,
  plan_interested text,
  timeline text,
  current_tools text[] not null default '{}',
  priorities text[] not null default '{}',
  budget text,
  heard_about text,
  anything_else text,
  product_name text not null default 'tensor',
  source text not null default 'tensor-agent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tensor_waitlist_email_unique unique (email)
);

-- Service-role only: RLS on, no public policies. The API writes with the
-- service key, which bypasses RLS. Reads happen in Supabase Studio.
alter table public.tensor_waitlist enable row level security;

create index if not exists tensor_waitlist_created_at_idx
  on public.tensor_waitlist (created_at desc);

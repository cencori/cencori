-- Maintenance mode (RFC-0001 cutover, 2026-10-23).
--
-- One row. While `enabled`, proxy.ts answers every request with 503 and a
-- Retry-After: JSON for the API, a short page for everything else. The status
-- host and the health check stay up, and anyone holding
-- MAINTENANCE_BYPASS_TOKEN gets through (smoke tests during the window).
--
-- The flag lives in the database rather than an env var so that switching it
-- needs no redeploy on either stack, and so the data copy carries it into the
-- Lagos database: Brimble comes up still in maintenance and is switched off by
-- hand once the smoke tests pass.
--
--   update public.platform_maintenance set enabled = true,  updated_at = now();
--   update public.platform_maintenance set enabled = false, updated_at = now();
--
-- The proxy caches the row for 10 seconds per instance, so a change takes up
-- to that long to reach every instance.

create table if not exists public.platform_maintenance (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  -- Shown to people and returned in the API error; null uses the default.
  message text,
  retry_after_seconds integer not null default 600 check (retry_after_seconds > 0),
  updated_at timestamptz not null default now()
);

insert into public.platform_maintenance (id) values (true) on conflict (id) do nothing;

-- service_role only: no policies, so anon and authenticated read nothing.
alter table public.platform_maintenance enable row level security;
revoke all on table public.platform_maintenance from anon, authenticated;

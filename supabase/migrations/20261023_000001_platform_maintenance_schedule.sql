-- Announce a maintenance window ahead of time (2026-10-23).
--
-- While scheduled_end is in the future, the dashboard shows a banner with the
-- window in the viewer's local time (GET /api/maintenance). Setting the
-- schedule does not start maintenance; `enabled` still does that.
--
--   update public.platform_maintenance
--   set scheduled_start = '2026-11-01 01:00+00', scheduled_end = '2026-11-01 01:30+00',
--       updated_at = now();
--
-- Clear both afterwards (or leave them: the banner stops once the end passes).

alter table public.platform_maintenance
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz;

alter table public.platform_maintenance
  drop constraint if exists platform_maintenance_schedule_order;
alter table public.platform_maintenance
  add constraint platform_maintenance_schedule_order
  check (scheduled_start is null or scheduled_end is null or scheduled_end > scheduled_start);

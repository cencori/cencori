-- Keep what was sent with each webhook delivery, so a replay sends the
-- original event again instead of a stub with only its id.
-- Idempotent: runs before every deploy.

alter table public.webhook_deliveries add column if not exists payload jsonb;

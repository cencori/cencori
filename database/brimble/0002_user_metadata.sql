-- Supabase kept per-user flags in auth.users.raw_user_meta_data
-- (welcome_email_sent_at, last_login_alert_sent_at, marketing_opted_out_at,
-- names). Better Auth's user gets the same as a json additional field
-- (lib/auth/better-auth.ts user.additionalFields.metadata); the user
-- migration script copies it across. Idempotent: runs before every deploy.

-- Only when missing: ALTER TABLE takes an exclusive lock on auth_users even
-- when the column exists, and this file runs on every deploy. One long-open
-- transaction on auth_users then stalled the deploy (and every sign-in queued
-- behind it) for 25 minutes on 2026-11-01.
do $$
begin
    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'auth_users' and column_name = 'metadata'
    ) then
        alter table "auth_users" add column "metadata" jsonb;
    end if;
end
$$;

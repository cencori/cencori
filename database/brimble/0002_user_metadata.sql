-- Supabase kept per-user flags in auth.users.raw_user_meta_data
-- (welcome_email_sent_at, last_login_alert_sent_at, marketing_opted_out_at,
-- names). Better Auth's user gets the same as a json additional field
-- (lib/auth/better-auth.ts user.additionalFields.metadata); the user
-- migration script copies it across. Idempotent: runs before every deploy.

alter table "auth_users" add column if not exists "metadata" jsonb;

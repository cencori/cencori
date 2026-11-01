-- Sign up and sign in with a phone number (Better Auth's phone-number plugin,
-- lib/auth/better-auth.ts): the codes go out on WhatsApp. A phone-only user
-- has a placeholder email (<digits>@phone.invalid) until they add a real one.
-- Idempotent: runs before every deploy.

alter table "auth_users" add column if not exists "phoneNumber" text;
alter table "auth_users" add column if not exists "phoneNumberVerified" boolean;
create unique index if not exists "auth_users_phoneNumber_key" on "auth_users" ("phoneNumber");

-- Extensions where the restored Supabase schema expects them (RFC-0001 §6.3).
-- Supabase installs uuid-ossp and pgcrypto in an `extensions` schema
-- (functions call extensions.uuid_generate_v4(), extensions.gen_random_bytes());
-- vector and pg_trgm live in public (column types and indexes use them).
-- Idempotent: runs before every deploy.

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema public;
create extension if not exists pg_trgm with schema public;

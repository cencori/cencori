-- PostgREST on the Brimble Postgres (RFC-0001 §5 Step A). Recreates the
-- Supabase roles and auth helpers that the app's 239 RLS policies, grants and
-- SECURITY DEFINER functions are written against, so the restored schema
-- works unchanged.
--
-- PostgREST connects as `authenticator` and switches to the role named in the
-- request's JWT (minted by the app, lib/data/postgrest-jwt.ts). Its password
-- is set from POSTGREST_AUTHENTICATOR_PASSWORD by scripts/brimble-apply-sql.mjs.
-- Idempotent: runs before every deploy.

do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role nologin noinherit bypassrls;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticator') then
        create role authenticator login noinherit;
    end if;
end
$$;

grant anon, authenticated, service_role to authenticator;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase's auth helpers, same definitions: read the claims PostgREST sets
-- per request from the verified JWT.
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create or replace function auth.jwt() returns jsonb
language sql stable
as $$
    select coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;

create or replace function auth.uid() returns uuid
language sql stable
as $$
    select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
    select coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
    )::text
$$;

create or replace function auth.email() returns text
language sql stable
as $$
    select coalesce(
        nullif(current_setting('request.jwt.claim.email', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
    )::text
$$;

grant execute on function auth.jwt(), auth.uid(), auth.role(), auth.email() to anon, authenticated, service_role;

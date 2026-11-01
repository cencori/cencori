-- Better Auth's tables hold password hashes and session tokens and live in
-- `public`, the schema PostgREST exposes. Supabase's schema grants new public
-- tables to anon/authenticated by default and relies on RLS, so lock these
-- explicitly: no API role may touch them, and RLS without policies denies
-- any role that still had a grant. Better Auth connects as the owner, not
-- through PostgREST, so it is unaffected.
--
-- Sorted last on purpose: re-applied after every other file on each deploy,
-- so a schema restore can't silently re-open them.

do $$
declare
    t text;
begin
    foreach t in array array['auth_users', 'auth_sessions', 'auth_accounts', 'auth_verifications'] loop
        if to_regclass('public.' || t) is null then
            continue;
        end if;
        -- Only what's missing: ALTER TABLE takes an exclusive lock even when
        -- RLS is already on, and a deploy waiting for it stalls sign-ins.
        if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
            execute format('alter table public.%I enable row level security', t);
        end if;
        if exists (
            select 1 from information_schema.role_table_grants
            where table_schema = 'public' and table_name = t
              and grantee in ('anon', 'authenticated', 'service_role')
        ) then
            execute format('revoke all on public.%I from anon, authenticated, service_role', t);
        end if;
    end loop;
end
$$;

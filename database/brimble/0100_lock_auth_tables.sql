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
        if to_regclass('public.' || t) is not null then
            execute format('alter table public.%I enable row level security', t);
            execute format('revoke all on public.%I from anon, authenticated, service_role', t);
        end if;
    end loop;
end
$$;

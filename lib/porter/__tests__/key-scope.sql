-- Run with psql -v ON_ERROR_STOP=1 -f against an EMPTY, DISPOSABLE database.
create schema extensions;
create extension pgcrypto with schema extensions;
create table public.api_keys (
  id text primary key, project_id uuid, name text, key_type text,
  client_app text constraint api_keys_client_app_check check (client_app is null or client_app in ('basecode')),
  key_hash text
);
create table public.porters (project_id uuid, publishable_key text);

insert into public.porters values ('00000000-0000-0000-0000-000000000001', 'cpk_existing_snippet');
insert into public.api_keys values
  ('current', '00000000-0000-0000-0000-000000000001', 'Renamed embed key', 'publishable', null,
    encode(extensions.digest('cpk_existing_snippet','sha256'),'hex')),
  ('orphan', '00000000-0000-0000-0000-000000000001', 'Porter (example.com)', 'publishable', null, 'orphan-hash'),
  ('generic', '00000000-0000-0000-0000-000000000001', 'Browser API', 'publishable', null, 'generic-hash'),
  ('secret', '00000000-0000-0000-0000-000000000001', 'Porter (server)', 'secret', null, 'secret-hash'),
  ('basecode', '00000000-0000-0000-0000-000000000001', 'Basecode', 'secret', 'basecode', 'basecode-hash');

\ir ../../../supabase/migrations/20260908_100000_porter_key_scope.sql
\ir ../../../supabase/migrations/20260908_100000_porter_key_scope.sql

do $$ begin
  if (select count(*) from public.api_keys where client_app = 'porter') <> 2 then
    raise exception 'Current and orphan Porter credentials were not scoped';
  end if;
  if exists(select 1 from public.api_keys where id in ('generic','secret') and client_app is not null) then
    raise exception 'Ordinary credentials changed';
  end if;
  if (select client_app from public.api_keys where id = 'basecode') <> 'basecode' then
    raise exception 'Basecode credential changed';
  end if;
  if (select publishable_key from public.porters limit 1) <> 'cpk_existing_snippet' then
    raise exception 'Existing snippet changed';
  end if;
  raise notice 'PASS: scoped current/orphan keys, preserved generic/Basecode credentials and snippets, migration replay';
end; $$;

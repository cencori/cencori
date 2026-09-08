-- Keep existing embed snippets working while removing their general gateway access.
begin;
set local search_path = public, extensions;

alter table public.api_keys drop constraint if exists api_keys_client_app_check;
alter table public.api_keys add constraint api_keys_client_app_check
    check (client_app is null or client_app in ('basecode', 'porter'));

update public.api_keys k
set client_app = 'porter'
where k.key_type = 'publishable'
  and k.client_app is null
  and (
      exists (
          select 1 from public.porters p
          where p.project_id = k.project_id
            and k.key_hash = encode(digest(p.publishable_key, 'sha256'), 'hex')
      )
      -- Also restrict keys left behind by an interrupted provisioning/rotation.
      or k.name like 'Porter (%)'
  );

comment on column public.api_keys.client_app is
    'Server-issued first-party credential scope. Porter keys only authorize Porter endpoints.';
commit;

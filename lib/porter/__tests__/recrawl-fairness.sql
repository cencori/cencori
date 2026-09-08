-- Run with psql -v ON_ERROR_STOP=1 -f against an EMPTY, DISPOSABLE PostgreSQL database.
-- The minimal schema isolates the real migration; no production connection is required.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end; $$;
create table public.porters (id uuid primary key, organization_id uuid not null, project_id uuid not null, source_url text not null, enabled boolean not null);
create table public.web_documents (id uuid primary key, project_id uuid, visibility text, next_crawl_at timestamptz);
\ir ../../../supabase/migrations/20260908_110000_porter_recrawl_fairness.sql
\ir ../../../supabase/migrations/20260908_110000_porter_recrawl_fairness.sql

-- The first20 sites have no due pages; the next30 are due; the last is disabled.
insert into public.porters (id, organization_id, project_id, source_url, enabled)
select lpad(i::text,32,'0')::uuid, lpad('1',32,'0')::uuid, lpad(i::text,32,'0')::uuid,
  'https://example' || i || '.com', i <> 51 from generate_series(1,51) i;
insert into public.web_documents (id, project_id, visibility, next_crawl_at)
select lpad(i::text,32,'0')::uuid, lpad(i::text,32,'0')::uuid, 'project', now() - interval '1 day'
from generate_series(21,51) i;

do $$
declare
  v_claim record;
  v_first uuid[] := '{}';
  v_next uuid[] := '{}';
  v_overlap_a record;
  v_overlap_b record;
  v_recovered record;
begin
  if has_function_privilege('anon','public.claim_porter_recrawl(uuid[])','execute')
    or has_function_privilege('authenticated','public.finish_porter_recrawl(uuid,uuid,jsonb,text)','execute')
    or not has_function_privilege('service_role','public.claim_porter_recrawl(uuid[])','execute') then
    raise exception 'RPC privilege regression';
  end if;
  for i in 1..20 loop
    select * into v_claim from public.claim_porter_recrawl(v_first);
    if v_claim.id is null or v_claim.id <= lpad('20',32,'0')::uuid or v_claim.id = lpad('51',32,'0')::uuid then
      raise exception 'Idle/disabled Porter claimed';
    end if;
    v_first := array_append(v_first,v_claim.id);
    if not public.finish_porter_recrawl(v_claim.id,v_claim.lease_token,'{"checked":1}',case when i=1 then 'fetch failed' else null end) then
      raise exception 'Lease release failed';
    end if;
  end loop;
  -- Keep even failed pages due: last-attempt fairness must give other sites their turn.
  for i in 1..10 loop
    select * into v_claim from public.claim_porter_recrawl(v_next);
    if v_claim.id is null or v_claim.id = any(v_first) then raise exception 'Porters beyond first20 starved'; end if;
    v_next := array_append(v_next,v_claim.id);
    perform public.finish_porter_recrawl(v_claim.id,v_claim.lease_token,'{"checked":1}',null);
  end loop;
  if (select count(*) from public.porters where recrawl_last_attempt_at is not null) <> 30 then
    raise exception 'Expected all30 due Porters visited';
  end if;
  if (select recrawl_last_error from public.porters where id=v_first[1]) <> 'fetch failed' then raise exception 'Failure not recorded'; end if;
  if exists(select 1 from public.claim_porter_recrawl(v_first || v_next)) then raise exception 'Run exclusion ignored'; end if;

  select * into v_overlap_a from public.claim_porter_recrawl();
  select * into v_overlap_b from public.claim_porter_recrawl();
  if v_overlap_a.id = v_overlap_b.id then raise exception 'Active lease claimed twice'; end if;
  if (select recrawl_lease_until - recrawl_last_attempt_at from public.porters where id=v_overlap_a.id) <> interval '6 minutes' then
    raise exception 'Incorrect lease duration';
  end if;
  perform public.finish_porter_recrawl(v_overlap_b.id,v_overlap_b.lease_token,'{}',null);

  update public.porters set enabled = (id = v_overlap_a.id);
  update public.porters set recrawl_lease_until = now() - interval '1 second' where id=v_overlap_a.id;
  select * into v_recovered from public.claim_porter_recrawl();
  if v_recovered.id <> v_overlap_a.id or v_recovered.lease_token = v_overlap_a.lease_token then raise exception 'Expired lease not recovered'; end if;
  if public.finish_porter_recrawl(v_overlap_a.id,v_overlap_a.lease_token,'{}','stale') then raise exception 'Stale worker released new lease'; end if;
  if not public.finish_porter_recrawl(v_recovered.id,v_recovered.lease_token,'{"checked":1}',null) then raise exception 'Recovered worker could not finish'; end if;
  raise notice 'PASS: idempotence, RPC privileges, fairness beyond20, idle/disabled exclusion, failure records, active leases, crash recovery, stale-token rejection';
end;
$$;

-- Durable, explicitly selected initial reads. Workers hold bounded leases; a new
-- worker can resume an interrupted page without losing earlier page outcomes.
create table if not exists public.porter_crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  porter_id uuid not null references public.porters(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  lease_token uuid,
  lease_until timestamptz,
  available_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists porter_crawl_jobs_active_idx
  on public.porter_crawl_jobs(porter_id) where status in ('queued','running');
create index if not exists porter_crawl_jobs_latest_idx
  on public.porter_crawl_jobs(porter_id, created_at desc, id);
create index if not exists porter_crawl_jobs_queue_idx
  on public.porter_crawl_jobs(available_at, last_attempt_at, id)
  where status in ('queued','running');

create table if not exists public.porter_crawl_pages (
  job_id uuid not null references public.porter_crawl_jobs(id) on delete cascade,
  position integer not null check (position between 0 and 24),
  url text not null check (length(url) between 1 and 4096),
  status text not null default 'pending' check (status in ('pending','running','indexed','failed','skipped')),
  document_id uuid references public.web_documents(id) on delete set null,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  error text,
  updated_at timestamptz not null default now(),
  primary key(job_id, position),
  unique(job_id, url)
);

create or replace function public.start_porter_crawl(
  p_porter_id uuid, p_user_id uuid, p_urls text[] default null, p_resume boolean default false
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_porter public.porters%rowtype;
  v_job public.porter_crawl_jobs%rowtype;
  v_urls text[];
  v_id uuid;
begin
  select * into v_porter from public.porters where id=p_porter_id for update;
  if not found then raise exception 'porter_not_found'; end if;
  if not exists(select 1 from public.organization_members where organization_id=v_porter.organization_id and user_id=p_user_id) then
    raise exception 'porter_crawl_forbidden';
  end if;
  select * into v_job from public.porter_crawl_jobs where porter_id=p_porter_id
    order by created_at desc, id desc limit 1 for update;
  if p_resume then
    if v_job.id is null then raise exception 'porter_crawl_missing'; end if;
    if v_job.status in ('queued','running','completed') then return v_job.id; end if;
    update public.porter_crawl_pages set status='pending', attempts=0, error=null, next_attempt_at=now(), updated_at=now()
      where job_id=v_job.id and (status='failed' or (status='skipped' and not exists(
        select 1 from public.porter_crawl_pages where job_id=v_job.id and status='indexed'
      )));
    update public.porter_crawl_jobs set status='queued', lease_token=null, lease_until=null,
      available_at=now(), error=null, completed_at=null, updated_at=now() where id=v_job.id;
    return v_job.id;
  end if;
  if coalesce(cardinality(p_urls),0) not between 1 and 25 then raise exception 'porter_crawl_invalid_selection'; end if;
  if exists(select 1 from unnest(p_urls) u where u is null or length(u) not between 1 and 4096) then
    raise exception 'porter_crawl_invalid_selection';
  end if;
  if v_job.status in ('queued','running') then
    select array_agg(url order by position) into v_urls from public.porter_crawl_pages where job_id=v_job.id;
    if v_urls=p_urls then return v_job.id; end if;
    raise exception 'porter_crawl_active';
  end if;
  insert into public.porter_crawl_jobs(porter_id,requested_by) values(p_porter_id,p_user_id) returning id into v_id;
  insert into public.porter_crawl_pages(job_id,position,url)
    select v_id, ordinal::integer-1, url from unnest(p_urls) with ordinality as s(url,ordinal);
  return v_id;
end; $$;

create or replace function public.claim_porter_crawl(p_job_id uuid default null)
returns table(id uuid, porter_id uuid, organization_id uuid, project_id uuid, source_url text, lease_token uuid)
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_token uuid := gen_random_uuid();
begin
  select j.id into v_id from public.porter_crawl_jobs j
    where j.status in ('queued','running') and j.available_at<=now()
      and (j.lease_until is null or j.lease_until<=now())
      and (p_job_id is null or j.id=p_job_id)
    order by j.last_attempt_at asc nulls first, j.created_at, j.id
    limit 1 for update of j skip locked;
  if v_id is null then return; end if;
  -- A process may have died after indexing but before saving its outcome. The
  -- same canonical URL is upserted on retry, so it never creates another page.
  update public.porter_crawl_pages set status=case when attempts>=3 then 'failed' else 'pending' end,
    error='The previous read was interrupted. Retrying this page.', next_attempt_at=now(), updated_at=now()
    where job_id=v_id and status='running';
  update public.porter_crawl_jobs set status='running',lease_token=v_token,
    lease_until=now()+interval '3 minutes',last_attempt_at=now(),updated_at=now() where porter_crawl_jobs.id=v_id;
  return query select j.id,p.id,p.organization_id,p.project_id,p.source_url,v_token
    from public.porter_crawl_jobs j join public.porters p on p.id=j.porter_id where j.id=v_id;
end; $$;

create or replace function public.claim_porter_crawl_page(p_job_id uuid,p_lease_token uuid)
returns table(position integer,url text,attempts integer)
language plpgsql security definer set search_path = '' as $$
declare v_position integer;
begin
  perform 1 from public.porter_crawl_jobs where id=p_job_id and status='running'
    and lease_token=p_lease_token and lease_until>now() for update;
  if not found then return; end if;
  -- A lease owns one page at a time, even when a caller retries the claim.
  if exists(select 1 from public.porter_crawl_pages where job_id=p_job_id and status='running') then return; end if;
  select p.position into v_position from public.porter_crawl_pages p
    where p.job_id=p_job_id and p.status='pending' and p.next_attempt_at<=now()
    order by p.position limit 1;
  if v_position is null then return; end if;
  return query update public.porter_crawl_pages p set status='running',attempts=p.attempts+1,updated_at=now()
    where p.job_id=p_job_id and p.position=v_position returning p.position,p.url,p.attempts;
end; $$;

create or replace function public.record_porter_crawl_page(
  p_job_id uuid,p_lease_token uuid,p_position integer,p_status text,
  p_document_id uuid default null,p_error text default null,p_retryable boolean default false
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_job public.porter_crawl_jobs%rowtype; v_porter public.porters%rowtype;
begin
  select * into v_job from public.porter_crawl_jobs where id=p_job_id and status='running'
    and lease_token=p_lease_token and lease_until>now() for update;
  if not found then return false; end if;
  if p_status not in ('indexed','failed','skipped') then raise exception 'porter_crawl_invalid_outcome'; end if;
  if p_status='indexed' then
    select * into v_porter from public.porters where id=v_job.porter_id;
    if p_document_id is null or not exists(select 1 from public.web_documents d where d.id=p_document_id
      and d.project_id=v_porter.project_id and d.organization_id=v_porter.organization_id
      and d.visibility='project' and d.collection_id='project:'||v_porter.project_id::text) then
      raise exception 'porter_crawl_document_scope_mismatch';
    end if;
  end if;
  update public.porter_crawl_pages set
    status=case when p_status='failed' and p_retryable and attempts<3 then 'pending' else p_status end,
    document_id=case when p_status='indexed' then p_document_id else null end,
    error=left(p_error,1000),next_attempt_at=now()+make_interval(secs=>30*attempts),updated_at=now()
    where job_id=p_job_id and position=p_position and status='running';
  if not found then return false; end if;
  update public.porter_crawl_jobs set updated_at=now() where id=p_job_id;
  return true;
end; $$;

create or replace function public.finish_porter_crawl_chunk(p_job_id uuid,p_lease_token uuid,p_error text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_job public.porter_crawl_jobs%rowtype;
  v_porter_id uuid;
  v_project_id uuid;
  v_pending integer;
  v_indexed integer;
  v_failed integer;
  v_available timestamptz;
begin
  select porter_id into v_porter_id from public.porter_crawl_jobs where id=p_job_id;
  -- Match start/resume's lock order, so a completion cannot deadlock a new read.
  select project_id into v_project_id from public.porters where id=v_porter_id for update;
  select * into v_job from public.porter_crawl_jobs where id=p_job_id and status='running'
    and lease_token=p_lease_token and lease_until>now() for update;
  if not found then return false; end if;
  update public.porter_crawl_pages set status=case when attempts>=3 then 'failed' else 'pending' end,
    error=coalesce(left(p_error,1000),'The read was interrupted. Retrying this page.'),
    next_attempt_at=now()+interval '30 seconds',updated_at=now()
    where job_id=p_job_id and status='running';
  -- A document removed elsewhere must be read again before it can be published.
  update public.porter_crawl_pages set status='failed',error='The indexed page is missing. Retry this read.',updated_at=now()
    where job_id=p_job_id and status='indexed' and document_id is null;
  select count(*) filter(where status='pending'),count(*) filter(where status='indexed'),
    count(*) filter(where status='failed'),min(next_attempt_at) filter(where status='pending')
    into v_pending,v_indexed,v_failed,v_available from public.porter_crawl_pages where job_id=p_job_id;
  if v_pending>0 then
    update public.porter_crawl_jobs set status='queued',lease_token=null,lease_until=null,
      available_at=greatest(now(),v_available),error=left(p_error,1000),updated_at=now() where id=p_job_id;
    return true;
  end if;
  if v_indexed>0 and v_failed=0 then
    -- Change the active selection atomically. Shared project documents remain
    -- intact, and failed replacement jobs leave the previous selection live.
    delete from public.porter_knowledge_documents where porter_id=v_job.porter_id;
    insert into public.porter_knowledge_documents(porter_id,document_id)
      select distinct v_job.porter_id,p.document_id from public.porter_crawl_pages p
      join public.web_documents d on d.id=p.document_id
      where p.job_id=p_job_id and p.status='indexed' and d.project_id=v_project_id
        and d.visibility='project' and d.collection_id='project:'||v_project_id::text;
    update public.web_documents d set next_crawl_at=now()+interval '7 days'
      where exists(select 1 from public.porter_knowledge_documents k where k.porter_id=v_job.porter_id and k.document_id=d.id);
    update public.porters set enabled=true,collection_id='project:'||v_project_id::text,updated_at=now() where id=v_job.porter_id;
  end if;
  update public.porter_crawl_jobs set status=case when v_indexed>0 and v_failed=0 then 'completed' else 'failed' end,
    lease_token=null,lease_until=null,completed_at=now(),updated_at=now(),
    error=case when v_failed>0 then 'Some pages could not be read. Retry to finish the selected knowledge.'
      when v_indexed=0 then 'None of the selected pages contained readable knowledge.' else null end
    where id=p_job_id;
  return true;
end; $$;

alter table public.porter_crawl_jobs enable row level security;
alter table public.porter_crawl_pages enable row level security;
revoke all on table public.porter_crawl_jobs,public.porter_crawl_pages from public,anon,authenticated;
grant all on table public.porter_crawl_jobs,public.porter_crawl_pages to service_role;
revoke all on function public.start_porter_crawl(uuid,uuid,text[],boolean) from public,anon,authenticated;
revoke all on function public.claim_porter_crawl(uuid) from public,anon,authenticated;
revoke all on function public.claim_porter_crawl_page(uuid,uuid) from public,anon,authenticated;
revoke all on function public.record_porter_crawl_page(uuid,uuid,integer,text,uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.finish_porter_crawl_chunk(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.start_porter_crawl(uuid,uuid,text[],boolean) to service_role;
grant execute on function public.claim_porter_crawl(uuid) to service_role;
grant execute on function public.claim_porter_crawl_page(uuid,uuid) to service_role;
grant execute on function public.record_porter_crawl_page(uuid,uuid,integer,text,uuid,text,boolean) to service_role;
grant execute on function public.finish_porter_crawl_chunk(uuid,uuid,text) to service_role;

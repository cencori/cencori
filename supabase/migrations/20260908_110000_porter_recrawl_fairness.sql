-- Refresh due Porters fairly across bounded cron runs, with recoverable per-Porter leases.
alter table public.porters
  add column if not exists recrawl_last_attempt_at timestamptz,
  add column if not exists recrawl_lease_until timestamptz,
  add column if not exists recrawl_lease_token uuid,
  add column if not exists recrawl_last_summary jsonb,
  add column if not exists recrawl_last_error text;

create index if not exists porters_recrawl_fairness_idx
  on public.porters (recrawl_last_attempt_at asc nulls first, id)
  where enabled;

create index if not exists web_documents_porter_recrawl_idx
  on public.web_documents (project_id, next_crawl_at, id)
  where visibility = 'project' and next_crawl_at is not null;

create or replace function public.claim_porter_recrawl(p_exclude_ids uuid[] default '{}'::uuid[])
returns table (id uuid, organization_id uuid, project_id uuid, source_url text, lease_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_now timestamptz := now();
begin
  select p.id into v_id
  from public.porters as p
  where p.enabled
    and (p.recrawl_lease_until is null or p.recrawl_lease_until <= v_now)
    and not (p.id = any(coalesce(p_exclude_ids, '{}'::uuid[])))
    and exists (
      select 1 from public.web_documents as d
      where d.project_id = p.project_id
        and d.visibility = 'project'
        and d.next_crawl_at <= v_now
    )
  order by p.recrawl_last_attempt_at asc nulls first, p.id
  limit 1
  for update of p skip locked;

  if v_id is null then return; end if;

  return query
  update public.porters as p
  set recrawl_last_attempt_at = v_now,
      recrawl_lease_until = v_now + interval '6 minutes',
      recrawl_lease_token = gen_random_uuid()
  where p.id = v_id
  returning p.id, p.organization_id, p.project_id, p.source_url, p.recrawl_lease_token;
end;
$$;

create or replace function public.finish_porter_recrawl(
  p_porter_id uuid,
  p_lease_token uuid,
  p_summary jsonb default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.porters
  set recrawl_lease_until = null,
      recrawl_lease_token = null,
      recrawl_last_summary = p_summary,
      recrawl_last_error = left(p_error, 2000)
  where id = p_porter_id and recrawl_lease_token = p_lease_token;
  return found;
end;
$$;

revoke all on function public.claim_porter_recrawl(uuid[]) from public, anon, authenticated;
revoke all on function public.finish_porter_recrawl(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.claim_porter_recrawl(uuid[]) to service_role;
grant execute on function public.finish_porter_recrawl(uuid, uuid, jsonb, text) to service_role;

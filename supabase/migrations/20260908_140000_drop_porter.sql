-- Remove Porter.
--
-- Porter's schema reached production while its code never did: the migrations were
-- applied by hand during development and the branch was abandoned before merge. What
-- is left is schema with nothing behind it. This removes it.
--
-- Written to be safe to run whether or not any given Porter migration was applied.
-- The only object here that lives on a shared table is the api_keys constraint and
-- the web_documents index, both restored to their pre-Porter state.
begin;
set local search_path = public, extensions;

-- 1. Functions. Dropped before their tables so a signature change cannot leave one
--    orphaned and shadowing a future name.
drop function if exists public.claim_porter_recrawl(uuid[]);
drop function if exists public.finish_porter_recrawl(uuid, uuid, jsonb, text);
drop function if exists public.start_porter_crawl(uuid, uuid, text[], boolean);
drop function if exists public.claim_porter_crawl(uuid);
drop function if exists public.claim_porter_crawl_page(uuid, uuid);
drop function if exists public.record_porter_crawl_page(uuid, uuid, integer, text, uuid, text, boolean);
drop function if exists public.finish_porter_crawl_chunk(uuid, uuid, text);

-- 2. Tables. Children first; cascade covers the policies, triggers and indexes that
--    belong to them, and the porters_touch_updated_at trigger function goes with it.
drop table if exists public.porter_crawl_pages cascade;
drop table if exists public.porter_crawl_jobs cascade;
drop table if exists public.porters cascade;
drop function if exists public.porters_touch_updated_at();

-- 3. The one index Porter added to a shared table. Nothing else reads this shape;
--    the platform ran without it before Porter and will again. Dropping an index is
--    a performance decision, never a correctness one, and it is one line to restore.
drop index if exists public.web_documents_porter_recrawl_idx;

-- 4. Give back the api_keys rows Porter claimed. These keys keep working exactly as
--    they did -- 'porter' never gated anything in shipped code, because the middleware
--    that would have enforced it was never merged. Clearing the mark before narrowing
--    the constraint is what keeps this migration from failing on its own data.
update public.api_keys set client_app = null where client_app = 'porter';

alter table public.api_keys drop constraint if exists api_keys_client_app_check;
alter table public.api_keys add constraint api_keys_client_app_check
    check (client_app is null or client_app in ('basecode'));

comment on column public.api_keys.client_app is
    'Server-issued first-party credential scope.';

commit;

-- Cencori OAuth (2026-11-19): another product asks a person for access to one of their Cencori
-- organizations. The person sees what is asked for and picks the organization; the product gets
-- a token limited to that organization and those permissions, for the management API
-- (/v1/organization, /v1/projects). The code is in lib/oauth; the rules are in
-- lib/oauth/protocol.ts.
--
-- Nothing secret is stored as it was issued: client secrets, codes and tokens are kept as their
-- SHA-256 only. Applied once by scripts/brimble-apply-sql.mjs before a deploy starts.

-- An app an organization registered.
create table if not exists public.oauth_apps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 200),
  website_url text check (website_url is null or char_length(website_url) <= 300),
  -- The app's logo: a copy of its website's icon, kept in our own file storage (lib/oauth/logo.ts).
  logo_url text,
  client_id text not null unique,
  client_secret_hash text not null,
  client_secret_last_four text not null,
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 10),
  scopes text[] not null check (cardinality(scopes) >= 1),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oauth_apps_organization_idx on public.oauth_apps (organization_id);

-- A person's yes: this app may act on this organization with these permissions. One row for each
-- app, organization and person; authorizing again replaces the permissions. Revoking sets
-- revoked_at and deletes the grant's tokens.
create table if not exists public.oauth_grants (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.oauth_apps(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  scopes text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  unique (app_id, organization_id, user_id)
);

create index if not exists oauth_grants_organization_idx on public.oauth_grants (organization_id);

-- The code sent back to the app after a yes. Good for five minutes and one exchange; bound to the
-- address it was sent to and to the app's PKCE challenge.
create table if not exists public.oauth_codes (
  code_hash text primary key,
  grant_id uuid not null references public.oauth_grants(id) on delete cascade,
  app_id uuid not null references public.oauth_apps(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scopes text[] not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists oauth_codes_expires_idx on public.oauth_codes (expires_at);

-- An access token and the refresh token issued with it. Refreshing writes a new row and stamps
-- this one's rotated_at; a refresh token presented after that has been copied by someone, so the
-- whole grant is revoked (lib/oauth/store.ts).
create table if not exists public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.oauth_grants(id) on delete cascade,
  access_token_hash text not null unique,
  refresh_token_hash text not null unique,
  scopes text[] not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  rotated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oauth_tokens_grant_idx on public.oauth_tokens (grant_id);
create index if not exists oauth_tokens_refresh_expires_idx on public.oauth_tokens (refresh_expires_at);

-- Exchanging a code: taking it and issuing the tokens has to be one step, or two requests racing
-- with the same code could both be given tokens. Returns the grant, or nothing when the code is
-- unknown, expired, already used, or was issued to another app.
create or replace function public.oauth_consume_code(p_code_hash text, p_app_id uuid)
returns table (grant_id uuid, redirect_uri text, code_challenge text, scopes text[])
language sql
security definer
set search_path = public
as $$
  delete from public.oauth_codes c
  where c.code_hash = p_code_hash
    and c.app_id = p_app_id
    and c.expires_at > now()
  returning c.grant_id, c.redirect_uri, c.code_challenge, c.scopes;
$$;

-- Using a refresh token: stamp it as used and say whether this call was the first to do so.
-- Nothing comes back for a token that was already used, which is what tells the caller it has
-- been presented twice.
create or replace function public.oauth_rotate_refresh_token(p_refresh_token_hash text)
returns table (id uuid, grant_id uuid, scopes text[])
language sql
security definer
set search_path = public
as $$
  update public.oauth_tokens t
  set rotated_at = now()
  where t.refresh_token_hash = p_refresh_token_hash
    and t.rotated_at is null
    and t.refresh_expires_at > now()
  returning t.id, t.grant_id, t.scopes;
$$;

revoke all on function public.oauth_consume_code(text, uuid) from public, anon, authenticated;
grant execute on function public.oauth_consume_code(text, uuid) to service_role;
revoke all on function public.oauth_rotate_refresh_token(text) from public, anon, authenticated;
grant execute on function public.oauth_rotate_refresh_token(text) to service_role;

-- Reached only by the server, with the service role. A browser never reads these tables.
alter table public.oauth_apps enable row level security;
revoke all on table public.oauth_apps from anon, authenticated;
grant all on table public.oauth_apps to service_role;

alter table public.oauth_grants enable row level security;
revoke all on table public.oauth_grants from anon, authenticated;
grant all on table public.oauth_grants to service_role;

alter table public.oauth_codes enable row level security;
revoke all on table public.oauth_codes from anon, authenticated;
grant all on table public.oauth_codes to service_role;

alter table public.oauth_tokens enable row level security;
revoke all on table public.oauth_tokens from anon, authenticated;
grant all on table public.oauth_tokens to service_role;

comment on table public.oauth_apps is 'An app an organization registered to ask people for access to their Cencori organizations.';
comment on table public.oauth_grants is 'A person''s authorization of an app for one organization, with the permissions given.';
comment on table public.oauth_codes is 'Authorization codes awaiting exchange, as hashes. Five minutes, one use.';
comment on table public.oauth_tokens is 'Access and refresh tokens issued under a grant, as hashes.';

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  challengeFor,
  formatScopes,
  hashSecret,
  newAccessToken,
  newAuthCode,
  newClientId,
  newClientSecret,
  newRefreshToken,
  sameValue,
  type OAuthScope,
} from "./protocol";

/**
 * Cencori OAuth: what is kept in the database (database/brimble/3200_oauth.sql), reached with
 * the service role. Every function takes the admin client so a route makes one and passes it on.
 */

export type OAuthApp = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  website_url: string | null;
  client_id: string;
  client_secret_last_four: string;
  redirect_uris: string[];
  scopes: string[];
  created_at: string;
  updated_at: string;
};

const APP_COLUMNS =
  "id, organization_id, name, description, website_url, client_id, client_secret_last_four, redirect_uris, scopes, created_at, updated_at";

/** An organization may register this many apps. Enough for real use, few enough to read. */
export const MAX_APPS_PER_ORGANIZATION = 25;

export type OrganizationRole = "owner" | "admin" | "member";

// --- Apps ----------------------------------------------------------------------------------

export async function listApps(db: SupabaseClient, organizationId: string): Promise<OAuthApp[]> {
  const { data, error } = await db
    .from("oauth_apps")
    .select(APP_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not list OAuth apps: ${error.message}`);
  return (data ?? []) as OAuthApp[];
}

export async function countApps(db: SupabaseClient, organizationId: string): Promise<number> {
  const { count, error } = await db
    .from("oauth_apps")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (error) throw new Error(`Could not count OAuth apps: ${error.message}`);
  return count ?? 0;
}

export async function getAppByClientId(db: SupabaseClient, clientId: string): Promise<OAuthApp | null> {
  const { data, error } = await db
    .from("oauth_apps")
    .select(APP_COLUMNS)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(`Could not read the OAuth app: ${error.message}`);
  return (data as OAuthApp | null) ?? null;
}

export type AppInput = {
  name: string;
  description: string | null;
  websiteUrl: string | null;
  redirectUris: string[];
  scopes: OAuthScope[];
};

/** The new app and its secret. The secret is returned here and nowhere else. */
export async function createApp(
  db: SupabaseClient,
  params: AppInput & { organizationId: string; createdBy: string },
): Promise<{ app: OAuthApp; clientSecret: string }> {
  const clientSecret = newClientSecret();
  const { data, error } = await db
    .from("oauth_apps")
    .insert({
      organization_id: params.organizationId,
      name: params.name,
      description: params.description,
      website_url: params.websiteUrl,
      client_id: newClientId(),
      client_secret_hash: hashSecret(clientSecret),
      client_secret_last_four: clientSecret.slice(-4),
      redirect_uris: params.redirectUris,
      scopes: params.scopes,
      created_by: params.createdBy,
    })
    .select(APP_COLUMNS)
    .single();
  if (error || !data) throw new Error(`Could not create the OAuth app: ${error?.message ?? "no row"}`);
  return { app: data as OAuthApp, clientSecret };
}

/**
 * Changes an app. Taking a permission away from the app also takes it from what people already
 * granted, so no token keeps something the app no longer asks for.
 */
export async function updateApp(
  db: SupabaseClient,
  params: AppInput & { organizationId: string; appId: string },
): Promise<OAuthApp | null> {
  const { data, error } = await db
    .from("oauth_apps")
    .update({
      name: params.name,
      description: params.description,
      website_url: params.websiteUrl,
      redirect_uris: params.redirectUris,
      scopes: params.scopes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.appId)
    .eq("organization_id", params.organizationId)
    .select(APP_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`Could not update the OAuth app: ${error.message}`);
  if (!data) return null;

  const { data: grants } = await db
    .from("oauth_grants")
    .select("id, scopes")
    .eq("app_id", params.appId)
    .is("revoked_at", null);
  for (const grant of (grants ?? []) as Array<{ id: string; scopes: string[] }>) {
    const kept = grant.scopes.filter((scope) => (params.scopes as string[]).includes(scope));
    if (kept.length === grant.scopes.length) continue;
    if (kept.length === 0) {
      await revokeGrantById(db, grant.id);
      continue;
    }
    await db.from("oauth_grants").update({ scopes: kept, updated_at: new Date().toISOString() }).eq("id", grant.id);
    await db.from("oauth_tokens").update({ scopes: kept }).eq("grant_id", grant.id);
    await db.from("oauth_codes").delete().eq("grant_id", grant.id);
  }
  return data as OAuthApp;
}

/** A new secret; the old one stops working at once. Tokens already issued are not affected. */
export async function rotateAppSecret(
  db: SupabaseClient,
  params: { organizationId: string; appId: string },
): Promise<{ app: OAuthApp; clientSecret: string } | null> {
  const clientSecret = newClientSecret();
  const { data, error } = await db
    .from("oauth_apps")
    .update({
      client_secret_hash: hashSecret(clientSecret),
      client_secret_last_four: clientSecret.slice(-4),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.appId)
    .eq("organization_id", params.organizationId)
    .select(APP_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`Could not rotate the secret: ${error.message}`);
  return data ? { app: data as OAuthApp, clientSecret } : null;
}

/** Deletes an app. Every grant, code and token of it goes with it (on delete cascade). */
export async function deleteApp(
  db: SupabaseClient,
  params: { organizationId: string; appId: string },
): Promise<OAuthApp | null> {
  const { data, error } = await db
    .from("oauth_apps")
    .delete()
    .eq("id", params.appId)
    .eq("organization_id", params.organizationId)
    .select(APP_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`Could not delete the OAuth app: ${error.message}`);
  return (data as OAuthApp | null) ?? null;
}

/** Whether this is the app's secret. */
export async function verifyClientSecret(
  db: SupabaseClient,
  appId: string,
  clientSecret: string,
): Promise<boolean> {
  const { data } = await db.from("oauth_apps").select("client_secret_hash").eq("id", appId).maybeSingle();
  const stored = (data as { client_secret_hash?: string } | null)?.client_secret_hash;
  return typeof stored === "string" && sameValue(stored, hashSecret(clientSecret));
}

// --- Who may say yes -----------------------------------------------------------------------

export type GrantableOrganization = {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
};

/**
 * A person's role in an organization, or null when they have none. The owner is whoever
 * organizations.owner_id names, whatever the members table says.
 */
export async function organizationRole(
  db: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<OrganizationRole | null> {
  const { data: org } = await db
    .from("organizations")
    .select("owner_id")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org) return null;
  if ((org as { owner_id: string | null }).owner_id === userId) return "owner";
  const { data: member } = await db
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = (member as { role?: string } | null)?.role;
  return role === "owner" || role === "admin" || role === "member" ? role : null;
}

/**
 * The organizations a person can give an app access to: those they own or administer. A member
 * cannot hand an organization to another product.
 */
export async function grantableOrganizations(
  db: SupabaseClient,
  userId: string,
): Promise<GrantableOrganization[]> {
  const [{ data: owned }, { data: memberships }] = await Promise.all([
    db.from("organizations").select("id, name, slug").eq("owner_id", userId),
    db
      .from("organization_members")
      .select("role, organizations!inner(id, name, slug)")
      .eq("user_id", userId)
      .in("role", ["owner", "admin"]),
  ]);

  const byId = new Map<string, GrantableOrganization>();
  for (const org of (owned ?? []) as Array<{ id: string; name: string; slug: string }>) {
    byId.set(org.id, { ...org, role: "owner" });
  }
  type Membership = { role: string; organizations: { id: string; name: string; slug: string } | Array<{ id: string; name: string; slug: string }> };
  for (const row of (memberships ?? []) as unknown as Membership[]) {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    if (!org || byId.has(org.id)) continue;
    byId.set(org.id, { ...org, role: row.role === "owner" ? "owner" : "admin" });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Whether a person in this role may give these permissions. Creating API keys is the owner's
 * alone in the dashboard, so only the owner can give it to an app.
 */
export function roleMayGrant(role: OrganizationRole | null, scopes: readonly string[]): boolean {
  if (role === "owner") return true;
  if (role === "admin") return !scopes.includes("api_keys:write");
  return false;
}

// --- Codes ---------------------------------------------------------------------------------

/**
 * Records the yes and returns the code to send back. Authorizing an app again for the same
 * organization replaces what it was given before.
 */
export async function createAuthorizationCode(
  db: SupabaseClient,
  params: {
    app: OAuthApp;
    organizationId: string;
    userId: string;
    scopes: OAuthScope[];
    redirectUri: string;
    codeChallenge: string;
  },
): Promise<string> {
  const now = new Date().toISOString();
  const { data: grant, error: grantError } = await db
    .from("oauth_grants")
    .upsert(
      {
        app_id: params.app.id,
        organization_id: params.organizationId,
        user_id: params.userId,
        scopes: params.scopes,
        updated_at: now,
        revoked_at: null,
      },
      { onConflict: "app_id,organization_id,user_id" },
    )
    .select("id")
    .single();
  if (grantError || !grant) throw new Error(`Could not record the grant: ${grantError?.message ?? "no row"}`);
  const grantId = (grant as { id: string }).id;

  // Tokens from an earlier authorization keep working, but only for what was granted this time.
  await db.from("oauth_tokens").update({ scopes: params.scopes }).eq("grant_id", grantId);
  await db.from("oauth_codes").delete().lt("expires_at", now);

  const code = newAuthCode();
  const { error } = await db.from("oauth_codes").insert({
    code_hash: hashSecret(code),
    grant_id: grantId,
    app_id: params.app.id,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    scopes: params.scopes,
    expires_at: new Date(Date.now() + AUTH_CODE_TTL_MS).toISOString(),
  });
  if (error) throw new Error(`Could not store the authorization code: ${error.message}`);
  return code;
}

// --- Tokens --------------------------------------------------------------------------------

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

async function issueTokens(db: SupabaseClient, grantId: string, scopes: string[]): Promise<TokenResponse> {
  const accessToken = newAccessToken();
  const refreshToken = newRefreshToken();
  const now = Date.now();
  const { error } = await db.from("oauth_tokens").insert({
    grant_id: grantId,
    access_token_hash: hashSecret(accessToken),
    refresh_token_hash: hashSecret(refreshToken),
    scopes,
    access_expires_at: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
    refresh_expires_at: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString(),
  });
  if (error) throw new Error(`Could not issue tokens: ${error.message}`);
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: formatScopes(scopes),
  };
}

async function activeGrant(db: SupabaseClient, grantId: string): Promise<GrantRow | null> {
  const { data } = await db
    .from("oauth_grants")
    .select("id, app_id, organization_id, user_id, scopes, revoked_at")
    .eq("id", grantId)
    .maybeSingle();
  const grant = data as (GrantRow & { revoked_at: string | null }) | null;
  return grant && !grant.revoked_at ? grant : null;
}

type GrantRow = {
  id: string;
  app_id: string;
  organization_id: string;
  user_id: string;
  scopes: string[];
};

/**
 * A code for tokens. Null when anything about the code is wrong: unknown, expired, used before,
 * issued to another app, sent to another address, or the verifier does not match the challenge.
 * The code is taken in one step (oauth_consume_code), so it is spent even when a later check
 * fails, and two requests with the same code cannot both succeed.
 */
export async function exchangeCode(
  db: SupabaseClient,
  params: { app: OAuthApp; code: string; redirectUri: string; codeVerifier: string },
): Promise<TokenResponse | null> {
  const { data, error } = await db.rpc("oauth_consume_code", {
    p_code_hash: hashSecret(params.code),
    p_app_id: params.app.id,
  });
  if (error) throw new Error(`Could not read the authorization code: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { grant_id: string; redirect_uri: string; code_challenge: string; scopes: string[] }
    | null
    | undefined;
  if (!row) return null;
  if (row.redirect_uri !== params.redirectUri) return null;
  if (!sameValue(row.code_challenge, challengeFor(params.codeVerifier))) return null;

  const grant = await activeGrant(db, row.grant_id);
  if (!grant) return null;
  return issueTokens(db, grant.id, grant.scopes);
}

/**
 * A refresh token for new tokens. The old pair stops working. A refresh token that was already
 * used has been copied by someone, and there is no telling which holder is the app, so the
 * whole grant is revoked and the person has to authorize again.
 */
export async function refreshTokens(
  db: SupabaseClient,
  params: { app: OAuthApp; refreshToken: string },
): Promise<TokenResponse | null> {
  const refreshHash = hashSecret(params.refreshToken);
  const { data: existing } = await db
    .from("oauth_tokens")
    .select("id, grant_id, rotated_at, oauth_grants!inner(app_id)")
    .eq("refresh_token_hash", refreshHash)
    .maybeSingle();
  type Existing = { id: string; grant_id: string; rotated_at: string | null; oauth_grants: { app_id: string } | Array<{ app_id: string }> };
  const found = existing as unknown as Existing | null;
  if (!found) return null;
  const owner = Array.isArray(found.oauth_grants) ? found.oauth_grants[0] : found.oauth_grants;
  if (!owner || owner.app_id !== params.app.id) return null;

  const { data, error } = await db.rpc("oauth_rotate_refresh_token", { p_refresh_token_hash: refreshHash });
  if (error) throw new Error(`Could not use the refresh token: ${error.message}`);
  const rotated = (Array.isArray(data) ? data[0] : data) as { id: string; grant_id: string } | null | undefined;
  if (!rotated) {
    if (found.rotated_at) await revokeGrantById(db, found.grant_id);
    return null;
  }

  const grant = await activeGrant(db, rotated.grant_id);
  if (!grant) return null;
  // The pair this one replaced is no longer needed to spot a replay of an older token.
  await db.from("oauth_tokens").delete().eq("grant_id", grant.id).not("rotated_at", "is", null).neq("id", rotated.id);
  return issueTokens(db, grant.id, grant.scopes);
}

export type AccessContext = {
  grantId: string;
  appId: string;
  appName: string;
  organizationId: string;
  userId: string;
  scopes: string[];
};

/**
 * Who an access token speaks for, or null when it is unknown, expired or its grant was revoked.
 *
 * The person who authorized has to still hold the role that let them: a token does not outlive
 * its giver's place in the organization.
 */
export async function verifyAccessToken(db: SupabaseClient, accessToken: string): Promise<AccessContext | null> {
  const { data } = await db
    .from("oauth_tokens")
    .select(
      "scopes, access_expires_at, rotated_at, oauth_grants!inner(id, app_id, organization_id, user_id, revoked_at, oauth_apps!inner(name))",
    )
    .eq("access_token_hash", hashSecret(accessToken))
    .maybeSingle();
  type GrantJoin = {
    id: string;
    app_id: string;
    organization_id: string;
    user_id: string;
    revoked_at: string | null;
    oauth_apps: { name: string } | Array<{ name: string }>;
  };
  type Row = { scopes: string[]; access_expires_at: string; rotated_at: string | null; oauth_grants: GrantJoin | GrantJoin[] };
  const row = data as unknown as Row | null;
  if (!row || row.rotated_at) return null;
  if (new Date(row.access_expires_at).getTime() <= Date.now()) return null;
  const grant = Array.isArray(row.oauth_grants) ? row.oauth_grants[0] : row.oauth_grants;
  if (!grant || grant.revoked_at) return null;

  const role = await organizationRole(db, grant.organization_id, grant.user_id);
  if (!roleMayGrant(role, row.scopes)) return null;

  const app = Array.isArray(grant.oauth_apps) ? grant.oauth_apps[0] : grant.oauth_apps;
  void db
    .from("oauth_grants")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", grant.id)
    .then(() => undefined, () => undefined);

  return {
    grantId: grant.id,
    appId: grant.app_id,
    appName: app?.name ?? "OAuth app",
    organizationId: grant.organization_id,
    userId: grant.user_id,
    scopes: row.scopes,
  };
}

// --- Grants --------------------------------------------------------------------------------

export type GrantSummary = {
  id: string;
  app_name: string;
  app_website_url: string | null;
  user_id: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
};

/** The apps that have access to an organization now. */
export async function listGrants(db: SupabaseClient, organizationId: string): Promise<GrantSummary[]> {
  const { data, error } = await db
    .from("oauth_grants")
    .select("id, user_id, scopes, created_at, last_used_at, oauth_apps!inner(name, website_url)")
    .eq("organization_id", organizationId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not list authorized apps: ${error.message}`);
  type AppJoin = { name: string; website_url: string | null };
  type Row = { id: string; user_id: string; scopes: string[]; created_at: string; last_used_at: string | null; oauth_apps: AppJoin | AppJoin[] };
  return ((data ?? []) as unknown as Row[]).map((row) => {
    const app = Array.isArray(row.oauth_apps) ? row.oauth_apps[0] : row.oauth_apps;
    return {
      id: row.id,
      app_name: app?.name ?? "OAuth app",
      app_website_url: app?.website_url ?? null,
      user_id: row.user_id,
      scopes: row.scopes,
      created_at: row.created_at,
      last_used_at: row.last_used_at,
    };
  });
}

async function revokeGrantById(db: SupabaseClient, grantId: string): Promise<void> {
  await db.from("oauth_grants").update({ revoked_at: new Date().toISOString() }).eq("id", grantId);
  await db.from("oauth_tokens").delete().eq("grant_id", grantId);
  await db.from("oauth_codes").delete().eq("grant_id", grantId);
}

/** Takes an app's access to an organization away. Its tokens stop working at once. */
export async function revokeGrant(
  db: SupabaseClient,
  params: { organizationId: string; grantId: string },
): Promise<boolean> {
  const { data } = await db
    .from("oauth_grants")
    .select("id")
    .eq("id", params.grantId)
    .eq("organization_id", params.organizationId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return false;
  await revokeGrantById(db, params.grantId);
  return true;
}

/**
 * RFC 7009: an app hands back a token it no longer needs. Either kind ends the grant, since
 * the two are issued together. Nothing is said about whether the token existed.
 */
export async function revokeByToken(db: SupabaseClient, params: { app: OAuthApp; token: string }): Promise<void> {
  const hash = hashSecret(params.token);
  const { data } = await db
    .from("oauth_tokens")
    .select("grant_id, oauth_grants!inner(app_id)")
    .or(`access_token_hash.eq.${hash},refresh_token_hash.eq.${hash}`)
    .maybeSingle();
  type Row = { grant_id: string; oauth_grants: { app_id: string } | Array<{ app_id: string }> };
  const row = data as unknown as Row | null;
  if (!row) return;
  const owner = Array.isArray(row.oauth_grants) ? row.oauth_grants[0] : row.oauth_grants;
  if (!owner || owner.app_id !== params.app.id) return;
  await revokeGrantById(db, row.grant_id);
}

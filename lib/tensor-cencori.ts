import type { createAdminClient } from "@/lib/supabaseAdmin";
import { openForUser, sealForUser, type TensorCloudConfig } from "@/lib/tensor-cloud";
import type { TensorCloudTask } from "@/lib/tensor-cloud-tasks";

/**
 * Cencori for Tensor projects (database/brimble/3200_tensor_cencori.sql), through Cencori OAuth
 * (docs/oauth): the person approves Tensor for one of their Cencori organizations; Tensor then
 * makes a secret API key in a Cencori project of theirs (one they pick, or a new one) and keeps it
 * as the Tensor project's CENCORI_API_KEY, so the app calls models through Cencori on their bill.
 *
 * An access token lasts an hour and a refresh token can be used once: using one twice revokes the
 * whole authorization. So a refresh is never run twice at once for a person (one in flight is
 * shared), and the new pair is saved before the token is used.
 */

type Admin = ReturnType<typeof createAdminClient>;

const ISSUER = (process.env.OAUTH_ISSUER_URL || "https://cencori.com").replace(/\/+$/, "");
const API = (process.env.CENCORI_MANAGEMENT_API_URL || "https://api.cencori.com/v1").replace(/\/+$/, "");
const ACCOUNTS = "tensor_cencori_accounts";
const LINKS = "tensor_cloud_cencori_links";
const SEAL_PURPOSE = "tensor-cencori-tokens";

/** What Tensor asks for: the organization's name, its projects, and making (and revoking) keys. */
export const TENSOR_CENCORI_SCOPES = "organization:read projects:write api_keys:write";

/** Where Cencori returns a person who approved Tensor. Registered on the OAuth app. */
export const TENSOR_CENCORI_CALLBACK_URL =
  process.env.TENSOR_CENCORI_CALLBACK_URL?.trim() || "https://cencori.com/api/tensor/integrations/cencori/callback";

export const CENCORI_AUTHORIZE_URL = `${ISSUER}/oauth/authorize`;

export type CencoriApp = { clientId: string; clientSecret: string };

export function readCencoriApp(env: Record<string, string | undefined> = process.env): CencoriApp | null {
  const clientId = env.TENSOR_CENCORI_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.TENSOR_CENCORI_OAUTH_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

type Tokens = { accessToken: string; refreshToken: string | null; expiresAt: number };

export class CencoriError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function askForTokens(app: CencoriApp, body: Record<string, string>, fetcher: typeof fetch): Promise<Tokens | null> {
  const response = await fetcher(`${ISSUER}/api/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      authorization: `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const json = (await response.json().catch(() => null)) as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown } | null;
  if (typeof json?.access_token !== "string" || !json.access_token) return null;
  const lifetime = typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : 3600;
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" && json.refresh_token ? json.refresh_token : null,
    expiresAt: Math.floor(Date.now() / 1000) + lifetime,
  };
}

export function exchangeCencoriCode(app: CencoriApp, code: string, verifier: string, fetcher: typeof fetch = fetch) {
  return askForTokens(app, { grant_type: "authorization_code", code, redirect_uri: TENSOR_CENCORI_CALLBACK_URL, code_verifier: verifier }, fetcher);
}

export async function saveCencoriAccount(admin: Admin, config: TensorCloudConfig, userId: string, tokens: Tokens, organizationName?: string | null): Promise<void> {
  const { error } = await admin.from(ACCOUNTS).upsert(
    {
      user_id: userId,
      sealed: sealForUser(tokens, config.taskTokenSecret, userId, SEAL_PURPOSE),
      ...(organizationName !== undefined ? { organization_name: organizationName } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function readCencoriAccountName(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin.from(ACCOUNTS).select("organization_name").eq("user_id", userId).maybeSingle();
  return (data as { organization_name?: string | null } | null)?.organization_name ?? null;
}

/** Takes Tensor's access away: revoked at Cencori (best effort) and forgotten here. */
export async function forgetCencoriAccount(admin: Admin, config: TensorCloudConfig, app: CencoriApp, userId: string, fetcher: typeof fetch = fetch): Promise<void> {
  const { data } = await admin.from(ACCOUNTS).select("sealed").eq("user_id", userId).maybeSingle();
  const tokens = data ? (openForUser((data as { sealed: string }).sealed, config.taskTokenSecret, userId, SEAL_PURPOSE) as Tokens | null) : null;
  const token = tokens?.refreshToken ?? tokens?.accessToken;
  if (token) {
    await fetcher(`${ISSUER}/api/oauth/revoke`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
  }
  const { error } = await admin.from(ACCOUNTS).delete().eq("user_id", userId);
  if (error) throw error;
}

/** Refreshes in flight, by person: a second caller waits for the first instead of reusing its token. */
const refreshing = new Map<string, Promise<string | null>>();

/**
 * A token for the person's Cencori organization that works now. Undefined when they never
 * connected; null when the connection can no longer be used (they revoked it): they connect again.
 */
export async function cencoriToken(admin: Admin, config: TensorCloudConfig, app: CencoriApp, userId: string, fetcher: typeof fetch = fetch): Promise<string | null | undefined> {
  const { data, error } = await admin.from(ACCOUNTS).select("sealed").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const tokens = openForUser((data as { sealed: string }).sealed, config.taskTokenSecret, userId, SEAL_PURPOSE) as Tokens | null;
  if (!tokens?.accessToken) return null;
  if (tokens.expiresAt - 60 > Math.floor(Date.now() / 1000)) return tokens.accessToken;
  if (!tokens.refreshToken) return null;
  const running = refreshing.get(userId);
  if (running) return running;
  const refresh = (async () => {
    const renewed = await askForTokens(app, { grant_type: "refresh_token", refresh_token: tokens.refreshToken! }, fetcher);
    if (!renewed) return null;
    await saveCencoriAccount(admin, config, userId, { ...renewed, refreshToken: renewed.refreshToken ?? null });
    return renewed.accessToken;
  })().finally(() => refreshing.delete(userId));
  refreshing.set(userId, refresh);
  return refresh;
}

/** One call to Cencori's management API, as the person's authorization. */
async function management<T>(token: string, path: string, init: { method?: string; body?: unknown } = {}, fetcher: typeof fetch = fetch): Promise<T> {
  const response = await fetcher(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!response) throw new CencoriError(503, "Cencori could not be reached. Try again.");
  const json = (await response.json().catch(() => null)) as (T & { error?: { message?: unknown } | string }) | null;
  if (!response.ok) {
    const said = typeof json?.error === "string" ? json.error : typeof json?.error?.message === "string" ? json.error.message : null;
    if (response.status === 401) throw new CencoriError(401, "Your Cencori connection has lapsed. Connect it again.");
    if (response.status === 403) throw new CencoriError(403, said ?? "Tensor was not given that permission on Cencori. Connect it again.");
    throw new CencoriError(response.status >= 500 ? 503 : 400, said ?? `Cencori answered ${response.status}.`);
  }
  return json as T;
}

export type CencoriProject = { id: string; name: string };

function projectFrom(raw: Record<string, unknown>): CencoriProject | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const name = typeof raw.name === "string" ? raw.name : null;
  return id && name ? { id, name } : null;
}

export async function readOrganization(token: string, fetcher: typeof fetch = fetch): Promise<{ name: string } | null> {
  const organization = await management<Record<string, unknown>>(token, "/organization", {}, fetcher);
  return typeof organization?.name === "string" ? { name: organization.name } : null;
}

export async function listCencoriProjects(token: string, fetcher: typeof fetch = fetch): Promise<CencoriProject[]> {
  const listed = await management<{ data?: Record<string, unknown>[] }>(token, "/projects", {}, fetcher);
  return (listed.data ?? []).map(projectFrom).filter((one): one is CencoriProject => one !== null);
}

export async function createCencoriProject(token: string, name: string, fetcher: typeof fetch = fetch): Promise<CencoriProject> {
  const made = await management<Record<string, unknown>>(token, "/projects", { method: "POST", body: { name: name.slice(0, 60) } }, fetcher);
  const project = projectFrom(made);
  if (!project) throw new CencoriError(503, "Cencori did not say which project it made.");
  return project;
}

/** A new secret key in a project: its value is given only now, never again. */
export async function createCencoriKey(token: string, projectId: string, name: string, fetcher: typeof fetch = fetch): Promise<{ id: string; key: string; prefix: string | null }> {
  const made = await management<Record<string, unknown>>(
    token,
    `/projects/${encodeURIComponent(projectId)}/api-keys`,
    { method: "POST", body: { name: name.slice(0, 80), environment: "production", type: "secret" } },
    fetcher,
  );
  const id = typeof made.id === "string" ? made.id : null;
  const key = typeof made.key === "string" ? made.key : typeof made.secret === "string" ? made.secret : null;
  if (!id || !key) throw new CencoriError(503, "Cencori did not give the new key.");
  const prefix = typeof made.key_prefix === "string" ? made.key_prefix : typeof made.prefix === "string" ? made.prefix : null;
  return { id, key, prefix };
}

export async function revokeCencoriKey(token: string, projectId: string, keyId: string, fetcher: typeof fetch = fetch): Promise<void> {
  await management(token, `/projects/${encodeURIComponent(projectId)}/api-keys/${encodeURIComponent(keyId)}`, { method: "DELETE" }, fetcher);
}

export type CencoriLink = { task_id: string; project_id: string; project_name: string; key_id: string; key_prefix: string | null; linked_at: string };

export async function readCencoriLink(admin: Admin, taskId: string): Promise<CencoriLink | null> {
  const { data, error } = await admin.from(LINKS).select("*").eq("task_id", taskId).maybeSingle();
  if (error) throw error;
  return (data as CencoriLink | null) ?? null;
}

export async function saveCencoriLink(
  admin: Admin,
  task: Pick<TensorCloudTask, "id" | "user_id">,
  link: { projectId: string; projectName: string; keyId: string; keyPrefix: string | null },
): Promise<void> {
  const { error } = await admin.from(LINKS).upsert(
    {
      task_id: task.id,
      user_id: task.user_id,
      project_id: link.projectId,
      project_name: link.projectName,
      key_id: link.keyId,
      key_prefix: link.keyPrefix,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "task_id" },
  );
  if (error) throw error;
}

export async function deleteCencoriLink(admin: Admin, taskId: string): Promise<void> {
  const { error } = await admin.from(LINKS).delete().eq("task_id", taskId);
  if (error) throw error;
}

/** The variables the integration writes, to name them and to take them away again. */
export const CENCORI_VARIABLE_NAMES = ["CENCORI_API_KEY"];

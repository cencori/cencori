import { randomBytes } from "node:crypto";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import {
  normalizeVariables,
  openForUser,
  sealForUser,
  type TensorCloudConfig,
  type TensorCloudVariable,
} from "@/lib/tensor-cloud";
import { giveSiteVariables, readDeployment, readVariables, writeVariables, type TensorCloudTask } from "@/lib/tensor-cloud-tasks";

/**
 * Supabase for Tensor projects (database/brimble/2800_tensor_supabase.sql).
 *
 * A person connects their own Supabase account through Supabase's OAuth for integrations; Tensor
 * then makes a Supabase project for a Tensor project, in an organisation of theirs, or links one
 * they already have, and writes what the app needs to reach it into the project's environment
 * variables. The database is in their Supabase account, on their plan: Tensor pays nothing for
 * it and keeps only the sign-in (sealed) and which project is which.
 *
 * Supabase's OAuth endpoints are documented as beta. Its Management API answers 120 requests a
 * minute per user, per endpoint.
 */

type Admin = ReturnType<typeof createAdminClient>;

const API = "https://api.supabase.com";
const ACCOUNTS = "tensor_supabase_accounts";
const LINKS = "tensor_cloud_supabase_links";
const SEAL_PURPOSE = "tensor-supabase-tokens";
const PASSWORD_PURPOSE = "tensor-supabase-db-password";

/** Where Supabase returns a person who connected their account. Registered on the OAuth app. */
export const TENSOR_SUPABASE_CALLBACK_URL =
  process.env.TENSOR_SUPABASE_CALLBACK_URL?.trim() || "https://cencori.com/api/tensor/integrations/supabase/callback";

export type SupabaseApp = { clientId: string; clientSecret: string };

export function readSupabaseApp(env: Record<string, string | undefined> = process.env): SupabaseApp | null {
  const clientId = env.SUPABASE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.SUPABASE_OAUTH_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

type Tokens = { accessToken: string; refreshToken: string | null; expiresAt: number };

/** Asks Supabase for tokens: for a code just given, or for a refresh of ones that ran out. */
async function askForTokens(app: SupabaseApp, body: Record<string, string>, fetcher: typeof fetch): Promise<Tokens | null> {
  const response = await fetcher(`${API}/v1/oauth/token`, {
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

export function exchangeSupabaseCode(app: SupabaseApp, code: string, verifier: string, fetcher: typeof fetch = fetch) {
  return askForTokens(app, { grant_type: "authorization_code", code, redirect_uri: TENSOR_SUPABASE_CALLBACK_URL, code_verifier: verifier }, fetcher);
}

export async function saveSupabaseAccount(admin: Admin, config: TensorCloudConfig, userId: string, tokens: Tokens): Promise<void> {
  const { error } = await admin
    .from(ACCOUNTS)
    .upsert({ user_id: userId, sealed: sealForUser(tokens, config.taskTokenSecret, userId, SEAL_PURPOSE), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function forgetSupabaseAccount(admin: Admin, userId: string): Promise<void> {
  const { error } = await admin.from(ACCOUNTS).delete().eq("user_id", userId);
  if (error) throw error;
}

/**
 * A token for the person's Supabase that works now, renewed when the one on record has run out.
 * Undefined when they never connected; null when the sign-in can no longer be used (they took
 * the access away on Supabase): they connect again.
 */
export async function supabaseToken(
  admin: Admin,
  config: TensorCloudConfig,
  app: SupabaseApp,
  userId: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null | undefined> {
  const { data, error } = await admin.from(ACCOUNTS).select("sealed").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const tokens = openForUser((data as { sealed: string }).sealed, config.taskTokenSecret, userId, SEAL_PURPOSE) as Tokens | null;
  if (!tokens?.accessToken) return null;
  if (tokens.expiresAt - 60 > Math.floor(Date.now() / 1000)) return tokens.accessToken;
  if (!tokens.refreshToken) return null;
  const renewed = await askForTokens(app, { grant_type: "refresh_token", refresh_token: tokens.refreshToken }, fetcher);
  if (!renewed) return null;
  // A refresh token is used once: the new pair is on record before the token is.
  await saveSupabaseAccount(admin, config, userId, { ...renewed, refreshToken: renewed.refreshToken ?? tokens.refreshToken });
  return renewed.accessToken;
}

export class SupabaseError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** One call to Supabase's Management API, as the person. */
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
  if (!response) throw new SupabaseError(503, "Supabase could not be reached. Try again.");
  const json = (await response.json().catch(() => null)) as (T & { message?: unknown; error?: unknown }) | null;
  if (!response.ok) {
    const said = typeof json?.message === "string" ? json.message : typeof json?.error === "string" ? json.error : null;
    if (response.status === 401) throw new SupabaseError(401, "Your Supabase connection has lapsed. Connect it again.");
    if (response.status === 402) throw new SupabaseError(402, said ?? "Your Supabase plan does not allow another project in that organization.");
    if (response.status === 429) throw new SupabaseError(429, "Supabase is busy. Try again in a minute.");
    throw new SupabaseError(response.status >= 500 ? 503 : 400, said ?? `Supabase answered ${response.status}.`);
  }
  return json as T;
}

export type SupabaseOrganization = { slug: string; name: string };
export type SupabaseProject = { ref: string; name: string; organizationSlug: string | null; region: string | null; status: string };

function projectFrom(raw: Record<string, unknown>): SupabaseProject | null {
  const ref = typeof raw.ref === "string" ? raw.ref : typeof raw.id === "string" ? raw.id : null;
  if (!ref) return null;
  return {
    ref,
    name: typeof raw.name === "string" ? raw.name : ref,
    organizationSlug: typeof raw.organization_slug === "string" ? raw.organization_slug : typeof raw.organization_id === "string" ? raw.organization_id : null,
    region: typeof raw.region === "string" ? raw.region : null,
    status: typeof raw.status === "string" ? raw.status : "UNKNOWN",
  };
}

export async function listOrganizations(token: string, fetcher?: typeof fetch): Promise<SupabaseOrganization[]> {
  const list = await management<Array<Record<string, unknown>>>(token, "/v1/organizations", {}, fetcher);
  return (Array.isArray(list) ? list : [])
    .map((one) => ({ slug: typeof one.slug === "string" ? one.slug : typeof one.id === "string" ? one.id : "", name: typeof one.name === "string" ? one.name : "" }))
    .filter((one) => one.slug);
}

export async function listProjects(token: string, fetcher?: typeof fetch): Promise<SupabaseProject[]> {
  const list = await management<Array<Record<string, unknown>>>(token, "/v1/projects", {}, fetcher);
  return (Array.isArray(list) ? list : []).map(projectFrom).filter((one): one is SupabaseProject => one !== null);
}

export async function readProject(token: string, ref: string, fetcher?: typeof fetch): Promise<SupabaseProject | null> {
  return projectFrom(await management<Record<string, unknown>>(token, `/v1/projects/${encodeURIComponent(ref)}`, {}, fetcher));
}

/** Regions a new project may be put in. Supabase keeps others; these are the ones offered. */
export const SUPABASE_REGIONS = ["us-east-1", "us-west-1", "eu-west-2", "eu-central-1", "ap-southeast-1", "ap-south-1", "sa-east-1"] as const;

export async function createProject(
  token: string,
  input: { organizationSlug: string; name: string; region: string; password: string },
  fetcher?: typeof fetch,
): Promise<SupabaseProject> {
  const made = await management<Record<string, unknown>>(
    token,
    "/v1/projects",
    { method: "POST", body: { name: input.name, organization_slug: input.organizationSlug, db_pass: input.password, region: input.region } },
    fetcher,
  );
  const project = projectFrom(made);
  if (!project) throw new SupabaseError(503, "Supabase did not say which project it made.");
  return project;
}

/** What the app needs to reach a project, as environment variables. */
export async function projectVariables(token: string, ref: string, password: string | null, fetcher?: typeof fetch): Promise<TensorCloudVariable[]> {
  const keys = await management<Array<Record<string, unknown>>>(token, `/v1/projects/${encodeURIComponent(ref)}/api-keys?reveal=true`, {}, fetcher);
  const find = (names: string[], type: string) =>
    (Array.isArray(keys) ? keys : []).find((one) => (names.includes(String(one.name)) || one.type === type) && typeof one.api_key === "string" && one.api_key)?.api_key as
      | string
      | undefined;
  const anon = find(["anon"], "publishable");
  const service = find(["service_role"], "secret");
  if (!anon) throw new SupabaseError(409, "Supabase has no keys for this project yet. Try again in a moment.");
  const url = `https://${ref}.supabase.co`;
  const variables: TensorCloudVariable[] = [
    { name: "SUPABASE_URL", value: url },
    { name: "NEXT_PUBLIC_SUPABASE_URL", value: url },
    { name: "SUPABASE_ANON_KEY", value: anon },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: anon },
    ...(service ? [{ name: "SUPABASE_SERVICE_ROLE_KEY", value: service }] : []),
  ];
  if (password) variables.push({ name: "DATABASE_URL", value: await databaseUrl(token, ref, password, fetcher) });
  return variables;
}

/** Postgres through Supabase's pooler, with the password in it; the direct address when there is none. */
async function databaseUrl(token: string, ref: string, password: string, fetcher?: typeof fetch): Promise<string> {
  const secret = encodeURIComponent(password);
  try {
    const pools = await management<Array<Record<string, unknown>>>(token, `/v1/projects/${encodeURIComponent(ref)}/config/database/pooler`, {}, fetcher);
    const primary = (Array.isArray(pools) ? pools : []).find((one) => one.database_type === "PRIMARY") ?? (Array.isArray(pools) ? pools[0] : undefined);
    if (primary && typeof primary.db_user === "string" && typeof primary.db_host === "string") {
      const port = typeof primary.db_port === "number" ? primary.db_port : 6543;
      const name = typeof primary.db_name === "string" ? primary.db_name : "postgres";
      return `postgresql://${primary.db_user}:${secret}@${primary.db_host}:${port}/${name}`;
    }
  } catch {
    // No pooler to be had: the direct address below.
  }
  return `postgresql://postgres:${secret}@db.${ref}.supabase.co:5432/postgres`;
}

/** A password for a project Tensor makes: long, and of characters an address can hold as they are. */
export function newDatabasePassword(): string {
  return randomBytes(24).toString("base64url");
}

/* ---------------------------------------------------------------------------
   A Tensor project's Supabase project
   --------------------------------------------------------------------------- */

export type SupabaseLink = {
  task_id: string;
  user_id: string;
  project_ref: string;
  project_name: string;
  organization_slug: string | null;
  region: string | null;
  created_by_tensor: boolean;
  sealed_password: string | null;
  status: "creating" | "ready";
  linked_at: string;
};

export async function readLink(admin: Admin, taskId: string): Promise<SupabaseLink | null> {
  const { data, error } = await admin.from(LINKS).select("*").eq("task_id", taskId).maybeSingle();
  if (error) throw error;
  return (data as SupabaseLink | null) ?? null;
}

export async function saveLink(
  admin: Admin,
  config: TensorCloudConfig,
  task: Pick<TensorCloudTask, "id" | "user_id">,
  link: { projectRef: string; projectName: string; organizationSlug: string | null; region: string | null; createdByTensor: boolean; password: string | null; status: "creating" | "ready" },
): Promise<void> {
  const { error } = await admin.from(LINKS).upsert(
    {
      task_id: task.id,
      user_id: task.user_id,
      project_ref: link.projectRef,
      project_name: link.projectName,
      organization_slug: link.organizationSlug,
      region: link.region,
      created_by_tensor: link.createdByTensor,
      sealed_password: link.password ? sealForUser(link.password, config.taskTokenSecret, task.user_id, PASSWORD_PURPOSE) : null,
      status: link.status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "task_id" },
  );
  if (error) throw error;
}

export function linkPassword(config: TensorCloudConfig, link: SupabaseLink): string | null {
  if (!link.sealed_password) return null;
  const opened = openForUser(link.sealed_password, config.taskTokenSecret, link.user_id, PASSWORD_PURPOSE);
  return typeof opened === "string" ? opened : null;
}

export async function markLinkReady(admin: Admin, taskId: string): Promise<void> {
  const { error } = await admin.from(LINKS).update({ status: "ready", updated_at: new Date().toISOString() }).eq("task_id", taskId);
  if (error) throw error;
}

export async function deleteLink(admin: Admin, taskId: string): Promise<void> {
  const { error } = await admin.from(LINKS).delete().eq("task_id", taskId);
  if (error) throw error;
}

/** The names of the variables a link writes, to say which they are and to take them away again. */
export const SUPABASE_VARIABLE_NAMES = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
];

/**
 * Puts the Supabase variables into a project's own, replacing any of the same name and leaving the
 * rest as they are, and hands them to a published app as saving them in Settings does.
 */
export async function mergeProjectVariables(
  admin: Admin,
  config: TensorCloudConfig,
  task: Pick<TensorCloudTask, "id" | "user_id">,
  add: TensorCloudVariable[],
  remove: string[] = [],
): Promise<TensorCloudVariable[]> {
  const before = await readVariables(admin, config, task.id);
  const replaced = new Set([...add.map((one) => one.name), ...remove]);
  const next = [...before.filter((one) => !replaced.has(one.name)), ...add];
  const checked = normalizeVariables(next);
  if (!checked.ok) throw new SupabaseError(400, checked.error);
  await writeVariables(admin, config, task, checked.variables);
  const deployment = await readDeployment(admin, task.id);
  if (deployment?.kind === "app" && deployment.machine_id && deployment.published_at) {
    const given = await giveSiteVariables(config, deployment, deployment.machine_id, checked.variables);
    if (!given.ok) console.error(`[Tensor Supabase] Giving variables to the app of task ${task.id} failed: ${given.error}`);
  }
  return checked.variables;
}

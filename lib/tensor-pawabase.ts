import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import { openForUser, sealForUser, type TensorCloudConfig, type TensorCloudVariable } from "@/lib/tensor-cloud";
import type { TensorCloudTask } from "@/lib/tensor-cloud-tasks";

/**
 * Pawabase for Tensor projects (database/brimble/3700_tensor_pawabase.sql). Pawabase is a backend
 * (database, accounts, storage, realtime) much like Supabase, and this mirrors lib/tensor-supabase.ts.
 *
 * A person connects their own Pawabase organization through Pawabase's OAuth for integrations
 * (one organization per connection: Pawabase names it with the tokens). Tensor then makes a
 * Pawabase project for a Tensor project, or links one they already have, and writes what the app
 * needs to reach it into the project's environment variables. The backend is in their Pawabase
 * account, on their plan; Tensor keeps only the sign-in (sealed) and which project is which.
 *
 * Two of Pawabase's rules shape this:
 * - A refresh token works once, and sending one again ends the whole connection. Refreshes are
 *   taken one at a time, across servers, by a claim on the account's row.
 * - Making a project takes an Idempotency-Key: the same key and body give back the same project
 *   for a day, so a retried request never makes a second one.
 *
 * Pawabase has no API for making an environment yet, so a project's default environment (a new
 * project's "development") serves both the preview and the published app.
 *
 * Docs: https://docs.pawabase.com/integrations/management-api, .../oauth-flow, .../scopes-and-roles
 */

type Admin = ReturnType<typeof createAdminClient>;

const ACCOUNTS = "tensor_pawabase_accounts";
const LINKS = "tensor_cloud_pawabase_links";
const SEAL_PURPOSE = "tensor-pawabase-tokens";

/** Pawabase's dashboard, which also answers its OAuth and Management API. */
export const PAWABASE_ORIGIN = (process.env.PAWABASE_ORIGIN?.trim() || "https://dashboard.pawabase.com").replace(/\/+$/, "");

/** Where Pawabase returns a person who connected their account. Registered on the OAuth app. */
export const TENSOR_PAWABASE_CALLBACK_URL =
  process.env.TENSOR_PAWABASE_CALLBACK_URL?.trim() || "https://cencori.com/api/tensor/integrations/pawabase/callback";

/** Read the organization and its projects, make projects, read and make their keys. */
export const PAWABASE_SCOPES = "organizations:read projects:read projects:write project:read project:write";

export type PawabaseApp = { clientId: string; clientSecret: string };

export function readPawabaseApp(env: Record<string, string | undefined> = process.env): PawabaseApp | null {
  const clientId = env.TENSOR_PAWABASE_CLIENT_ID?.trim();
  const clientSecret = env.TENSOR_PAWABASE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export type PawabaseTokens = { accessToken: string; refreshToken: string | null; expiresAt: number; organization: string | null };

export class PawabaseError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Asks Pawabase for tokens: for a code just given, or for a refresh of ones that ran out. Null
 * when Pawabase turned the grant down (invalid_grant: the connection is over), and an error when
 * it could not be asked.
 */
async function askForTokens(app: PawabaseApp, body: Record<string, string>, fetcher: typeof fetch): Promise<PawabaseTokens | null> {
  const response = await fetcher(`${PAWABASE_ORIGIN}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      authorization: `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response) throw new PawabaseError(503, "Pawabase could not be reached. Try again.");
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    if (response.status === 429) throw new PawabaseError(429, "Pawabase is busy. Try again in a minute.");
    if (response.status >= 500) throw new PawabaseError(503, "Pawabase could not be reached. Try again.");
    return null;
  }
  if (typeof json?.access_token !== "string" || !json.access_token) return null;
  const lifetime = typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : 3600;
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" && json.refresh_token ? json.refresh_token : null,
    expiresAt: Math.floor(Date.now() / 1000) + lifetime,
    organization: typeof json.organization === "string" ? json.organization : null,
  };
}

export function exchangePawabaseCode(app: PawabaseApp, code: string, verifier: string, fetcher: typeof fetch = fetch) {
  return askForTokens(app, { grant_type: "authorization_code", code, redirect_uri: TENSOR_PAWABASE_CALLBACK_URL, code_verifier: verifier }, fetcher);
}

export async function savePawabaseAccount(admin: Admin, config: TensorCloudConfig, userId: string, tokens: PawabaseTokens): Promise<void> {
  const { error } = await admin.from(ACCOUNTS).upsert(
    {
      refreshing_until: null,
      sealed: sealForUser(tokens, config.taskTokenSecret, userId, SEAL_PURPOSE),
      updated_at: new Date().toISOString(),
      user_id: userId,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

/** Forgets the sign-in here and tells Pawabase to end the connection (keys already made stay). */
export async function forgetPawabaseAccount(
  admin: Admin,
  config: TensorCloudConfig,
  app: PawabaseApp | null,
  userId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const { data } = await admin.from(ACCOUNTS).select("sealed").eq("user_id", userId).maybeSingle();
  const tokens = data ? (openForUser((data as { sealed: string }).sealed, config.taskTokenSecret, userId, SEAL_PURPOSE) as PawabaseTokens | null) : null;
  const { error } = await admin.from(ACCOUNTS).delete().eq("user_id", userId);
  if (error) throw error;
  if (app && tokens?.refreshToken) {
    await fetcher(`${PAWABASE_ORIGIN}/oauth/revoke`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ token: tokens.refreshToken, token_type_hint: "refresh_token" }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
  }
}

type Row = { sealed: string; refreshing_until: string | null };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Refreshes under way in this server, so two requests at once share one. */
const refreshing = new Map<string, Promise<PawabaseConnection | null>>();

export type PawabaseConnection = { token: string; organization: string | null };

/**
 * A token for the person's Pawabase that works now, renewed when the one on record has run out.
 * Undefined when they never connected; null when the connection is over (they ended it on
 * Pawabase, or a refresh token was turned down): they connect again.
 */
export async function pawabaseConnection(
  admin: Admin,
  config: TensorCloudConfig,
  app: PawabaseApp,
  userId: string,
  fetcher: typeof fetch = fetch,
  wait: { tries: number; everyMs: number } = { tries: 40, everyMs: 500 },
): Promise<PawabaseConnection | null | undefined> {
  const open = (row: Row) => openForUser(row.sealed, config.taskTokenSecret, userId, SEAL_PURPOSE) as PawabaseTokens | null;
  const fresh = (tokens: PawabaseTokens | null) => Boolean(tokens?.accessToken && tokens.expiresAt - 60 > Math.floor(Date.now() / 1000));
  const read = async () => {
    const { data, error } = await admin.from(ACCOUNTS).select("sealed, refreshing_until").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return (data as Row | null) ?? null;
  };

  const row = await read();
  if (!row) return undefined;
  const tokens = open(row);
  if (!tokens?.accessToken) return null;
  if (fresh(tokens)) return { organization: tokens.organization, token: tokens.accessToken };
  if (!tokens.refreshToken) return null;

  const pending = refreshing.get(userId);
  if (pending) return pending;
  const renewal = (async (): Promise<PawabaseConnection | null> => {
    // The claim: only a row nobody is refreshing (or whose refresher gave up) is taken.
    const now = new Date();
    const { data: claimed, error } = await admin
      .from(ACCOUNTS)
      .update({ refreshing_until: new Date(now.getTime() + 30_000).toISOString() })
      .eq("user_id", userId)
      .or(`refreshing_until.is.null,refreshing_until.lt.${now.toISOString()}`)
      .select("sealed, refreshing_until");
    if (error) throw error;
    const mine = (claimed as Row[] | null)?.[0];
    if (!mine) {
      // Another request has it: its new tokens are on record soon.
      for (let tried = 0; tried < wait.tries; tried += 1) {
        await sleep(wait.everyMs);
        const now = await read();
        if (!now) return null;
        const theirs = open(now);
        if (fresh(theirs)) return { organization: theirs?.organization ?? null, token: (theirs as PawabaseTokens).accessToken };
        if (!now.refreshing_until) break;
      }
      throw new PawabaseError(503, "Pawabase is still signing in. Try again in a moment.");
    }
    // Someone may have finished a refresh between the read and the claim.
    const latest = open(mine);
    if (fresh(latest) || !latest?.refreshToken) {
      await admin.from(ACCOUNTS).update({ refreshing_until: null }).eq("user_id", userId);
      return fresh(latest) ? { organization: latest?.organization ?? null, token: (latest as PawabaseTokens).accessToken } : null;
    }
    let renewed: PawabaseTokens | null;
    try {
      renewed = await askForTokens(app, { grant_type: "refresh_token", refresh_token: latest.refreshToken }, fetcher);
    } catch (failure) {
      // Pawabase was not reached, so the refresh token was not spent: it may be tried again.
      await admin.from(ACCOUNTS).update({ refreshing_until: null }).eq("user_id", userId);
      throw failure;
    }
    if (!renewed) {
      // Turned down: the connection is over. Kept as it is, so the page says to connect again.
      await admin.from(ACCOUNTS).update({ refreshing_until: null }).eq("user_id", userId);
      return null;
    }
    // The new pair is on record before the token is used; the old refresh token is spent.
    await savePawabaseAccount(admin, config, userId, {
      ...renewed,
      organization: renewed.organization ?? latest.organization,
      refreshToken: renewed.refreshToken ?? latest.refreshToken,
    });
    return { organization: renewed.organization ?? latest.organization, token: renewed.accessToken };
  })().finally(() => refreshing.delete(userId));
  refreshing.set(userId, renewal);
  return renewal;
}

/** One call to Pawabase's Management API, as the person. */
async function management<T>(
  token: string,
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const response = await fetcher(`${PAWABASE_ORIGIN}/v1${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!response) throw new PawabaseError(503, "Pawabase could not be reached. Try again.");
  const json = (await response.json().catch(() => null)) as (T & { error?: unknown; message?: unknown }) | null;
  if (!response.ok) {
    const code = typeof json?.error === "string" ? json.error : null;
    const said = typeof json?.message === "string" ? json.message : null;
    if (response.status === 401) throw new PawabaseError(401, "Your Pawabase connection has lapsed. Connect it again.", code);
    if (response.status === 403) {
      throw new PawabaseError(403, said ?? "Your role in this Pawabase organization does not allow that. An admin can do it.", code);
    }
    if (response.status === 402) throw new PawabaseError(402, said ?? "Your Pawabase plan does not allow that.", code);
    if (response.status === 429) throw new PawabaseError(429, "Pawabase is busy. Try again in a minute.", code);
    if (response.status === 404) throw new PawabaseError(404, said ?? "Pawabase did not find that.", code);
    if (response.status >= 500) throw new PawabaseError(503, "Pawabase could not be reached. Try again.", code);
    throw new PawabaseError(response.status === 409 ? 409 : 400, said ?? `Pawabase answered ${response.status}.`, code);
  }
  return json as T;
}

export type PawabaseEnvironment = { slug: string; key: string; status: string; isDefault: boolean };

export type PawabaseProject = {
  /** What the app client takes as `project`. */
  id: string;
  /** The project's slug; what the Management API's paths take (they take the id too). */
  ref: string;
  name: string;
  state: "creating" | "running" | "paused" | "failed" | string;
  failureReason: string | null;
  apiUrl: string | null;
  studioUrl: string | null;
  defaultEnvironment: string | null;
  environments: PawabaseEnvironment[] | null;
};

function projectFrom(raw: Record<string, unknown>): PawabaseProject | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const ref = typeof raw.ref === "string" ? raw.ref : typeof raw.slug === "string" ? raw.slug : id;
  if (!id || !ref) return null;
  const endpoints = raw.endpoints && typeof raw.endpoints === "object" ? (raw.endpoints as Record<string, unknown>) : {};
  const failure = raw.failure && typeof raw.failure === "object" ? (raw.failure as Record<string, unknown>) : null;
  const environments = Array.isArray(raw.environments)
    ? (raw.environments as Array<Record<string, unknown>>)
        .map((one) => ({
          isDefault: one.is_default === true,
          key: typeof one.key === "string" ? one.key : "",
          slug: typeof one.slug === "string" ? one.slug : "",
          status: typeof one.status === "string" ? one.status : "",
        }))
        .filter((one) => one.slug || one.key)
    : null;
  return {
    apiUrl: typeof endpoints.api === "string" ? endpoints.api : null,
    defaultEnvironment: typeof raw.default_environment === "string" ? raw.default_environment : null,
    environments,
    failureReason: failure && typeof failure.reason === "string" ? failure.reason : null,
    id,
    name: typeof raw.name === "string" ? raw.name : ref,
    ref,
    state: typeof raw.state === "string" ? raw.state : "unknown",
    studioUrl: typeof raw.studio === "string" && raw.studio.startsWith("https://") ? raw.studio : null,
  };
}

export async function listProjects(token: string, fetcher?: typeof fetch): Promise<PawabaseProject[]> {
  const list = await management<Array<Record<string, unknown>>>(token, "/projects", {}, fetcher);
  return (Array.isArray(list) ? list : []).map(projectFrom).filter((one): one is PawabaseProject => one !== null);
}

export async function readProject(token: string, ref: string, fetcher?: typeof fetch): Promise<PawabaseProject | null> {
  return projectFrom(await management<Record<string, unknown>>(token, `/projects/${encodeURIComponent(ref)}`, {}, fetcher));
}

/**
 * The Idempotency-Key for making a project for a Tensor project under a name: the same for a
 * retried request, so Pawabase gives back the project it already made instead of a second one.
 */
export function creationKey(taskId: string, name: string): string {
  const hex = createHash("sha256").update(`tensor-pawabase-project:${taskId}:${name}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function createProject(
  token: string,
  input: { taskId: string; name: string },
  fetcher?: typeof fetch,
): Promise<PawabaseProject> {
  const made = await management<Record<string, unknown>>(
    token,
    "/projects",
    {
      body: { description: "Made by Tensor", name: input.name },
      headers: { "idempotency-key": creationKey(input.taskId, input.name) },
      method: "POST",
    },
    fetcher,
  );
  const project = projectFrom(made);
  if (!project) throw new PawabaseError(503, "Pawabase did not say which project it made.");
  return project;
}

/** Tries a failed project again; it comes back "creating". */
export async function retryProject(token: string, ref: string, fetcher?: typeof fetch): Promise<PawabaseProject | null> {
  return projectFrom(await management<Record<string, unknown>>(token, `/projects/${encodeURIComponent(ref)}/retry`, { method: "POST" }, fetcher));
}

type ApiKey = { role: string; key: string | null; active: boolean; revokedAt: string | null; environments: unknown; name: string };

function keyFrom(raw: Record<string, unknown>): ApiKey {
  return {
    active: raw.active !== false,
    environments: raw.environments,
    key: typeof raw.key === "string" && raw.key ? raw.key : null,
    name: typeof raw.name === "string" ? raw.name : "",
    revokedAt: typeof raw.revoked_at === "string" ? raw.revoked_at : null,
    role: typeof raw.role === "string" ? raw.role : "",
  };
}

async function makeKey(token: string, ref: string, role: "publishable" | "secret", fetcher?: typeof fetch): Promise<string> {
  const made = keyFrom(
    await management<Record<string, unknown>>(
      token,
      `/projects/${encodeURIComponent(ref)}/api-keys`,
      { body: { environments: "all", name: role === "secret" ? "Tensor (server)" : "Tensor", role }, method: "POST" },
      fetcher,
    ),
  );
  if (!made.key) throw new PawabaseError(503, "Pawabase did not hand over the new key.");
  return made.key;
}

/**
 * The project's publishable key (pb_pk_, browser-safe): one Pawabase can show, preferring one that
 * reaches every environment. Keys made before Pawabase 0.32 cannot be shown; then Tensor makes one.
 */
export async function publishableKey(token: string, ref: string, fetcher?: typeof fetch): Promise<string> {
  const listed = await management<{ data?: Array<Record<string, unknown>> }>(token, `/projects/${encodeURIComponent(ref)}/api-keys`, {}, fetcher);
  const usable = (Array.isArray(listed?.data) ? listed.data : [])
    .map(keyFrom)
    .filter((one) => one.role === "publishable" && one.active && !one.revokedAt && one.key);
  const best = usable.find((one) => one.environments === "all") ?? usable[0];
  return best?.key ?? makeKey(token, ref, "publishable", fetcher);
}

/** A new secret key (pb_sk_, servers only, past access rules). Pawabase shows it this once. */
export function newSecretKey(token: string, ref: string, fetcher?: typeof fetch): Promise<string> {
  return makeKey(token, ref, "secret", fetcher);
}

/** The environment the app uses: the project's default, by its short name where Pawabase gives one. */
export function appEnvironment(project: PawabaseProject): string {
  const chosen = project.environments?.find((one) => one.isDefault);
  return chosen?.slug || chosen?.key || project.defaultEnvironment || "development";
}

/** What the app needs to reach a project, as environment variables (with copies a browser build reads). */
export function projectVariables(project: PawabaseProject, keys: { publishable: string; secret?: string | null }): TensorCloudVariable[] {
  if (!project.apiUrl) throw new PawabaseError(409, "Pawabase has not given this project an address yet. Try again in a moment.");
  const environment = appEnvironment(project);
  const shared: Array<[string, string]> = [
    ["PAWABASE_URL", project.apiUrl],
    ["PAWABASE_PROJECT", project.id],
    ["PAWABASE_ENV", environment],
    ["PAWABASE_PUBLISHABLE_KEY", keys.publishable],
  ];
  return [
    ...shared.map(([name, value]) => ({ name, value })),
    ...shared.map(([name, value]) => ({ name: `NEXT_PUBLIC_${name}`, value })),
    ...(keys.secret ? [{ name: "PAWABASE_SECRET_KEY", value: keys.secret }] : []),
  ];
}

/** The names of the variables a link writes, to take them away again. */
export const PAWABASE_VARIABLE_NAMES = [
  "PAWABASE_URL",
  "PAWABASE_PROJECT",
  "PAWABASE_ENV",
  "PAWABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_PAWABASE_URL",
  "NEXT_PUBLIC_PAWABASE_PROJECT",
  "NEXT_PUBLIC_PAWABASE_ENV",
  "NEXT_PUBLIC_PAWABASE_PUBLISHABLE_KEY",
  "PAWABASE_SECRET_KEY",
];

/* ---------------------------------------------------------------------------
   A Tensor project's Pawabase project
   --------------------------------------------------------------------------- */

export type PawabaseLink = {
  task_id: string;
  user_id: string;
  project_id: string;
  project_ref: string;
  project_name: string;
  organization: string | null;
  created_by_tensor: boolean;
  with_secret_key: boolean;
  status: "creating" | "ready" | "failed";
  failure_reason: string | null;
  linked_at: string;
};

export async function readLink(admin: Admin, taskId: string): Promise<PawabaseLink | null> {
  const { data, error } = await admin.from(LINKS).select("*").eq("task_id", taskId).maybeSingle();
  if (error) throw error;
  return (data as PawabaseLink | null) ?? null;
}

export async function saveLink(
  admin: Admin,
  task: Pick<TensorCloudTask, "id" | "user_id">,
  link: {
    projectId: string;
    projectRef: string;
    projectName: string;
    organization: string | null;
    createdByTensor: boolean;
    withSecretKey: boolean;
    status: PawabaseLink["status"];
    failureReason?: string | null;
  },
): Promise<void> {
  const { error } = await admin.from(LINKS).upsert(
    {
      created_by_tensor: link.createdByTensor,
      failure_reason: link.failureReason ?? null,
      organization: link.organization,
      project_id: link.projectId,
      project_name: link.projectName,
      project_ref: link.projectRef,
      status: link.status,
      task_id: task.id,
      updated_at: new Date().toISOString(),
      user_id: task.user_id,
      with_secret_key: link.withSecretKey,
    },
    { onConflict: "task_id" },
  );
  if (error) throw error;
}

export async function setLinkStatus(admin: Admin, taskId: string, status: PawabaseLink["status"], failureReason: string | null = null): Promise<void> {
  const { error } = await admin.from(LINKS).update({ failure_reason: failureReason, status, updated_at: new Date().toISOString() }).eq("task_id", taskId);
  if (error) throw error;
}

export async function deleteLink(admin: Admin, taskId: string): Promise<void> {
  const { error } = await admin.from(LINKS).delete().eq("task_id", taskId);
  if (error) throw error;
}

/**
 * The variables for a running project: its address, id, environment and publishable key, and a
 * new secret key when the link asked for one.
 */
export async function variablesFor(token: string, project: PawabaseProject, withSecretKey: boolean, fetcher?: typeof fetch) {
  const publishable = await publishableKey(token, project.ref, fetcher);
  const secret = withSecretKey ? await newSecretKey(token, project.ref, fetcher) : null;
  return projectVariables(project, { publishable, secret });
}

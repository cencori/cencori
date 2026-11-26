import "server-only";

import { adminUsers } from "@/lib/auth/admin-users";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import { gatewayHttpUrl, signDeployTicket, type TensorCloudConfig } from "@/lib/tensor-cloud";
import { profileJson, readProfileRow } from "@/lib/tensor-profile";

/**
 * Quality (usequality.app): visitor feedback on the apps people publish with Tensor.
 *
 * Tensor is one Quality app with partner access. Its server asks Quality for a token with its own
 * client id and secret (no one signs in to Quality), and speaks for every Tensor team with it, by
 * Tensor's own ids: Quality never hands Tensor ids to keep. Tensor has no teams yet, so each
 * person is a team of one, with the same id; each project is an app, at its published address.
 *
 * Registering an app returns its site id. The gateway adds Quality's script to the project's
 * pages with it (cloud/gateway/src/quality.ts in the Tensor repository), so nothing is written into
 * the project's own code. The app is registered again on every publish, which keeps its address
 * current through a rename.
 *
 * Docs: https://docs.usequality.app/docs/connect/script/cencori
 */

type Admin = ReturnType<typeof createAdminClient>;

export type QualityConfig = { clientId: string; clientSecret: string; apiOrigin: string };
/** Who may comment: the project's team, signed in, or any visitor under a typed name. */
export type QualityMode = "members" | "anyone";
export type QualityLink = { task_id: string; user_id: string; mode: QualityMode; site_id: string | null };

const TABLE = "tensor_cloud_quality";

export function readQualityConfig(): QualityConfig | null {
  const clientId = process.env.QUALITY_CLIENT_ID?.trim();
  const clientSecret = process.env.QUALITY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const apiOrigin = (process.env.QUALITY_API_ORIGIN?.trim() || "https://server.usequality.app").replace(/\/+$/, "");
  return { apiOrigin, clientId, clientSecret };
}

// ---------------------------------------------------------------------------------------------
// The partner API

/** One token serves every team for an hour; it is asked for again shortly before then. */
let token: { value: string; expiresAt: number; clientId: string } | null = null;

export class QualityError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function partnerToken(config: QualityConfig, fetcher: typeof fetch, fresh = false): Promise<string> {
  if (!fresh && token && token.clientId === config.clientId && Date.now() < token.expiresAt) return token.value;
  const response = await fetcher(`${config.apiOrigin}/oauth/apps/token`, {
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    headers: {
      authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });
  const said = (await response.json().catch(() => ({}))) as { access_token?: unknown; expires_in?: unknown; error?: unknown };
  if (!response.ok || typeof said.access_token !== "string") {
    // Partner access not on yet reads as unauthorized_client: Quality has to switch it on.
    const reason = typeof said.error === "string" ? said.error : `status ${response.status}`;
    throw new QualityError(503, `Quality refused Tensor's credentials (${reason}).`);
  }
  const lifetime = typeof said.expires_in === "number" ? said.expires_in : 3600;
  token = { clientId: config.clientId, expiresAt: Date.now() + Math.max(60, lifetime - 120) * 1000, value: said.access_token };
  return token.value;
}

/** A call to the partner API, with a fresh token once if the cached one was turned down. */
async function partner<T>(
  config: QualityConfig,
  method: "GET" | "PUT" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  for (const fresh of [false, true]) {
    const response = await fetcher(`${config.apiOrigin}/api/v1/partner${path}`, {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: {
        authorization: `Bearer ${await partnerToken(config, fetcher, fresh)}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      method,
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 401 && !fresh) continue;
    if (response.status === 204) return undefined as T;
    const said = (await response.json().catch(() => ({}))) as { error?: unknown };
    if (!response.ok) {
      throw new QualityError(
        response.status === 404 ? 404 : response.status === 409 ? 409 : 503,
        typeof said.error === "string" ? said.error : `Quality answered ${response.status}.`,
      );
    }
    return said as T;
  }
  throw new QualityError(503, "Quality refused Tensor's token.");
}

const path = (value: string) => encodeURIComponent(value);

/** The person behind a Tensor account, as Quality shows them: name, email, picture. */
async function person(admin: Admin, userId: string) {
  const [{ data }, row] = await Promise.all([adminUsers.getUserById(userId), readProfileRow(admin, userId)]);
  if (!data.user?.email) throw new QualityError(400, "Your account has no email address for Quality.");
  const profile = profileJson(row, data.user);
  return {
    avatar_url: profile.avatarUrl && profile.avatarUrl.startsWith("https://") ? profile.avatarUrl : undefined,
    email: data.user.email,
    first_name: profile.firstName ?? undefined,
    id: userId,
    last_name: profile.lastName ?? undefined,
  };
}

/** A person's Tensor team at Quality: theirs alone, with them as its owner. */
export async function syncQualityTeam(admin: Admin, config: QualityConfig, userId: string, fetcher: typeof fetch = fetch) {
  const owner = await person(admin, userId);
  const name = [owner.first_name, owner.last_name].filter(Boolean).join(" ") || owner.email;
  await partner(config, "PUT", `/teams/${path(userId)}`, {
    name,
    owner: { email: owner.email, first_name: owner.first_name, id: owner.id, last_name: owner.last_name },
  }, fetcher);
  await partner(config, "PUT", `/teams/${path(userId)}/members`, { members: [{ ...owner, role: "owner" }] }, fetcher);
}

/** Registers (or updates) a project as an app at its address; returns its site id. */
export async function upsertQualityApp(
  config: QualityConfig,
  input: { userId: string; taskId: string; name: string; productionUrl: string; mode: QualityMode },
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const app = await partner<{ site_id?: unknown }>(config, "PUT", `/teams/${path(input.userId)}/projects/${path(input.taskId)}`, {
    name: input.name,
    production_mode: input.mode,
    production_url: input.productionUrl,
  }, fetcher);
  if (typeof app.site_id !== "string") throw new QualityError(503, "Quality did not return a site id.");
  return app.site_id;
}

/** Turns Quality off for a project; its comments stay with Quality. */
export function removeQualityApp(config: QualityConfig, userId: string, taskId: string, fetcher: typeof fetch = fetch) {
  return partner<void>(config, "DELETE", `/teams/${path(userId)}/projects/${path(taskId)}`, undefined, fetcher);
}

/** A project's feedback threads, newest first, as Quality lists them. */
export function qualityThreads(
  config: QualityConfig,
  userId: string,
  taskId: string,
  query: { status?: string; search?: string; limit?: number; cursor?: string },
  fetcher: typeof fetch = fetch,
) {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(Math.min(Math.max(query.limit ?? 20, 1), 100)));
  return partner<unknown>(config, "GET", `/teams/${path(userId)}/projects/${path(taskId)}/threads?${params}`, undefined, fetcher);
}

/**
 * One thread with what led up to it: its comments and attachments, and the console messages,
 * failed network calls and clicks from the seconds before. Those last three are best effort: a
 * recording past Quality's retention simply leaves them out.
 */
export async function qualityThread(
  config: QualityConfig,
  userId: string,
  taskId: string,
  threadId: string,
  fetcher: typeof fetch = fetch,
) {
  const base = `/teams/${path(userId)}/projects/${path(taskId)}/threads/${path(threadId)}`;
  const optional = (suffix: string) =>
    partner<unknown>(config, "GET", `${base}/${suffix}`, undefined, fetcher).catch(() => null);
  const [thread, consoleLog, network, actions] = await Promise.all([
    partner<unknown>(config, "GET", base, undefined, fetcher),
    optional("console?limit=20"),
    optional("network?outcome=failed&limit=50"),
    optional("actions?limit=100"),
  ]);
  return { actions, console: consoleLog, network, thread };
}

// ---------------------------------------------------------------------------------------------
// The gateway, and what is kept here

/** Tells the gateway to add Quality's script to the project's pages (a site id), or stop (null). */
export async function setGatewayQuality(
  config: TensorCloudConfig,
  task: { id: string; user_id: string },
  siteName: string,
  siteId: string | null,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const ticket = signDeployTicket({ action: "quality", name: siteName, taskId: task.id, userId: task.user_id }, config.ticketSecret);
  const response = await fetcher(`${gatewayHttpUrl(config.gatewayUrl)}/v1/sites/quality?ticket=${encodeURIComponent(ticket)}`, {
    body: JSON.stringify({ siteId }),
    headers: { "content-type": "application/json" },
    method: "PUT",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const said = (await response.json().catch(() => ({}))) as { error?: unknown };
    throw new QualityError(503, typeof said.error === "string" ? said.error : "Publishing could not be reached.");
  }
}

export async function readQualityLink(admin: Admin, taskId: string): Promise<QualityLink | null> {
  const { data, error } = await admin.from(TABLE).select("task_id, user_id, mode, site_id").eq("task_id", taskId).maybeSingle();
  if (error) throw error;
  return (data as QualityLink | null) ?? null;
}

async function writeQualityLink(admin: Admin, link: QualityLink): Promise<void> {
  const { error } = await admin.from(TABLE).upsert({ ...link, updated_at: new Date().toISOString() }, { onConflict: "task_id" });
  if (error) throw error;
}

async function deleteQualityLink(admin: Admin, taskId: string): Promise<void> {
  const { error } = await admin.from(TABLE).delete().eq("task_id", taskId);
  if (error) throw error;
}

/** A project's published address, from its site name and the domain sites are served under. */
export function publishedUrl(siteName: string, sitesDomain: string): string {
  return `https://${siteName}.${sitesDomain}`;
}

/**
 * Turns Quality on for a published project (or changes who may comment): its owner's team is
 * brought up to date, the app registered at its address, and the gateway told its site id.
 */
export async function enableQuality(
  admin: Admin,
  cloud: TensorCloudConfig,
  config: QualityConfig,
  input: { task: { id: string; user_id: string }; title: string; siteName: string; sitesDomain: string; mode: QualityMode },
  fetcher: typeof fetch = fetch,
): Promise<QualityLink> {
  await syncQualityTeam(admin, config, input.task.user_id, fetcher);
  const siteId = await upsertQualityApp(config, {
    mode: input.mode,
    name: input.title,
    productionUrl: publishedUrl(input.siteName, input.sitesDomain),
    taskId: input.task.id,
    userId: input.task.user_id,
  }, fetcher);
  await setGatewayQuality(cloud, input.task, input.siteName, siteId, fetcher);
  const link: QualityLink = { mode: input.mode, site_id: siteId, task_id: input.task.id, user_id: input.task.user_id };
  await writeQualityLink(admin, link);
  return link;
}

/** Turns Quality off: the gateway stops adding the script, Quality hides the app, comments stay. */
export async function disableQuality(
  admin: Admin,
  cloud: TensorCloudConfig,
  config: QualityConfig,
  task: { id: string; user_id: string },
  siteName: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await setGatewayQuality(cloud, task, siteName, null, fetcher);
  await removeQualityApp(config, task.user_id, task.id, fetcher).catch((error: unknown) => {
    // Already gone at Quality is still off.
    if (!(error instanceof QualityError && error.status === 404)) throw error;
  });
  await deleteQualityLink(admin, task.id);
}

/**
 * After a publish: a project with Quality on is registered again at its (perhaps new) address and
 * the gateway reminded of its site id. A failure here never fails the publish.
 */
export async function refreshQualityAfterPublish(
  admin: Admin,
  cloud: TensorCloudConfig,
  input: { task: { id: string; user_id: string }; title: string; siteName: string; sitesDomain: string },
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const config = readQualityConfig();
  if (!config) return;
  const link = await readQualityLink(admin, input.task.id);
  if (!link) return;
  try {
    await enableQuality(admin, cloud, config, { ...input, mode: link.mode }, fetcher);
  } catch (error) {
    console.error(`[Tensor Quality] Keeping Quality on after publishing task ${input.task.id} failed`, error);
  }
}

import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Tensor in the cloud: a task that runs in a sandbox instead of on the user's own machine.
 *
 * Three parties, and what each is trusted with:
 *
 * - The sandbox is a Fly Machine, one per task, running the same agent runtime the desktop app
 *   bundles against a clone of the user's repository. It runs code nobody here has read, so it is
 *   given nothing that outlives the task: a credential for model calls that names this one task,
 *   and the hash (not the value) of the token that opens its own door.
 * - The gateway runs on Fly beside the sandboxes and relays a browser's WebSocket to one of them
 *   (Tensor repo, cloud/gateway). It trusts a ticket signed here and nothing else.
 * - Cencori, this app, decides: who may start a task, which machine a browser may reach, and
 *   whether a model call is covered by the account's plan.
 *
 * This file is the part of that with no I/O in it: what is signed, derived and validated. The
 * formats are shared with the gateway, and the tests pin them to the same vectors.
 */

export type TensorCloudConfig = {
  flyApiToken: string;
  /** The Fly app that holds the sandboxes. */
  sandboxApp: string;
  /** The image a sandbox boots, e.g. registry.fly.io/tensor-sandbox:<label>. */
  sandboxImage: string;
  sandboxRegion: string;
  /** Public wss:// origin of the gateway. */
  gatewayUrl: string;
  /** Signs the tickets the gateway accepts. Shared with the gateway. */
  ticketSecret: string;
  /** Derives each sandbox's own token. Shared with the gateway. */
  sandboxTokenSecret: string;
  /** Signs the credential a sandbox makes model calls with. Known only to this app. */
  taskTokenSecret: string;
  /** The Fly app that holds published apps' machines, one per project published with a server. */
  sitesApp: string;
  /**
   * The image such a machine boots, e.g. registry.fly.io/tensor-sites:<label>. Empty until that
   * is rolled out: static sites publish as before, and a project with a server is told it cannot
   * be published yet.
   */
  sitesImage: string;
  sitesRegion: string;
  /** A token for the sites app, when the sandbox app's own does not reach it. */
  sitesFlyApiToken: string;
};

/** Null when cloud tasks are not set up here, which is every environment until it is rolled out. */
export function readTensorCloudConfig(
  env: Record<string, string | undefined> = process.env,
): TensorCloudConfig | null {
  const read = (name: string) => env[name]?.trim() || "";
  const config: TensorCloudConfig = {
    flyApiToken: read("TENSOR_CLOUD_FLY_API_TOKEN"),
    sandboxApp: read("TENSOR_CLOUD_SANDBOX_APP") || "tensor-sandbox",
    sandboxImage: read("TENSOR_CLOUD_SANDBOX_IMAGE"),
    sandboxRegion: read("TENSOR_CLOUD_SANDBOX_REGION") || "jnb",
    gatewayUrl: read("TENSOR_CLOUD_GATEWAY_URL").replace(/\/+$/, ""),
    ticketSecret: read("TENSOR_CLOUD_TICKET_SECRET"),
    sandboxTokenSecret: read("TENSOR_CLOUD_SANDBOX_TOKEN_SECRET"),
    taskTokenSecret: read("TENSOR_CLOUD_TASK_TOKEN_SECRET"),
    sitesApp: read("TENSOR_CLOUD_SITES_APP") || "tensor-sites",
    sitesImage: read("TENSOR_CLOUD_SITES_IMAGE"),
    sitesRegion: read("TENSOR_CLOUD_SITES_REGION") || read("TENSOR_CLOUD_SANDBOX_REGION") || "jnb",
    sitesFlyApiToken: read("TENSOR_CLOUD_SITES_FLY_API_TOKEN") || read("TENSOR_CLOUD_FLY_API_TOKEN"),
  };
  const secrets = [config.ticketSecret, config.sandboxTokenSecret, config.taskTokenSecret];
  if (!config.flyApiToken || !config.sandboxImage || !/^wss:\/\//.test(config.gatewayUrl)) {
    return null;
  }
  // Three secrets doing three jobs: one reused across them would let whoever holds the weakest
  // (the gateway's) mint the strongest (a credential for model calls).
  if (secrets.some((secret) => secret.length < 32) || new Set(secrets).size !== secrets.length) {
    return null;
  }
  return config;
}

/* ---------------------------------------------------------------------------
   Signing
   --------------------------------------------------------------------------- */

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signJwt(claims: Record<string, unknown>, secret: string): string {
  const signingInput = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

/** The claims of a token this app signed, or null. The signature is checked before anything is read. */
function verifyJwt(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsedHeader?.alg !== "HS256") return null;
    return typeof claims === "object" && claims !== null && !Array.isArray(claims) ? claims : null;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
   Gateway tickets
   --------------------------------------------------------------------------- */

export const GATEWAY_TICKET_AUDIENCE = "tensor-cloud-gateway";
/** A ticket is spent the moment the page receives it; the gateway refuses anything over five minutes. */
export const GATEWAY_TICKET_TTL_SECONDS = 60;

/**
 * Lets one browser connect once to one task's sandbox.
 *
 * It travels in a URL, because a page cannot set headers on a WebSocket, so it is made to be
 * worthless anywhere else: a minute's life, a single use, one machine.
 */
export function signGatewayTicket(
  input: { userId: string; taskId: string; machineId: string },
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): string {
  return signJwt(
    {
      aud: GATEWAY_TICKET_AUDIENCE,
      sub: input.userId,
      task: input.taskId,
      machine: input.machineId,
      jti: randomBytes(18).toString("base64url"),
      iat: now,
      exp: now + GATEWAY_TICKET_TTL_SECONDS,
    },
    secret,
  );
}

/* ---------------------------------------------------------------------------
   Publishing: a project's site, at an address of its own
   --------------------------------------------------------------------------- */

export const DEPLOY_TICKET_AUDIENCE = "tensor-cloud-deploy";
/**
 * Long enough for the upload it is for, which follows a build. It still works only once, for one
 * name, and only to put files there (or take them away).
 */
export const DEPLOY_TICKET_TTL_SECONDS = 15 * 60;

/** Names nobody can publish under: they read as the service's own, or as something to trust. */
const RESERVED_SITE_NAMES = new Set([
  "www", "app", "api", "admin", "auth", "login", "signin", "signup", "account", "accounts", "billing", "pay", "payments",
  "mail", "email", "smtp", "ftp", "ns", "ns1", "ns2", "dns", "cdn", "static", "assets", "status", "docs", "help", "support",
  "blog", "dashboard", "console", "preview", "previews", "gateway", "sandbox", "internal", "root", "test", "staging", "dev",
  "cencori", "tensor", "tensorade", "security", "abuse", "postmaster", "webmaster", "localhost",
]);

export const SITE_NAME_MIN = 3;
export const SITE_NAME_MAX = 40;

/**
 * A name as it can stand in an address: lower-case letters, digits and single dashes, three to
 * forty characters. "Bola's Bakery!" becomes "bola-s-bakery". Null when nothing usable is left,
 * or the name is one that is not given out.
 */
export function normalizeSiteName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SITE_NAME_MAX)
    .replace(/-+$/, "");
  if (name.length < SITE_NAME_MIN || RESERVED_SITE_NAMES.has(name)) return null;
  return name;
}

/**
 * Lets one upload put a project's site at one name, or take it away. Carried in a URL to the
 * gateway, which holds and serves the sites. `replaces` is a name the project published under
 * before: the gateway removes that copy once the new one is in place.
 */
export function signDeployTicket(
  input: {
    userId: string;
    taskId: string;
    name: string;
    /**
     * "env": hand a published app's machine the project's environment variables. "plan": bring a
     * published app in line with its owner's plan as it is now (its limits, or `paused`). "access":
     * who may see the project's site, anyone or whoever has its password. "quality": Quality's
     * feedback toolbar on the project's pages, or not (lib/tensor-quality.ts).
     */
    action: "publish" | "remove" | "env" | "plan" | "access" | "quality";
    replaces?: string | null;
    /** An app is published to its own machine, which the ticket names; a static site has none. */
    machineId?: string | null;
    /** What the owner's plan allows that app, for the gateway to hold it to. */
    limits?: Pick<SiteAllowance, "monthlyBytes" | "monthlyAwakeSeconds" | "uploadBytes" | "appBytes"> | null;
    /** "plan": the owner's plan does not include this app at the moment. */
    paused?: boolean;
  },
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): string {
  return signJwt(
    {
      aud: DEPLOY_TICKET_AUDIENCE,
      sub: input.userId,
      task: input.taskId,
      name: input.name,
      action: input.action,
      ...(input.replaces ? { replaces: input.replaces } : {}),
      ...(input.action === "publish" && input.machineId ? { kind: "app", machine: input.machineId } : {}),
      ...(input.action === "env" && input.machineId ? { kind: "app", machine: input.machineId } : {}),
      ...(input.action === "plan" && input.paused ? { paused: true } : {}),
      // A site of files carries them too: what it sends counts against the account's data.
      ...((input.action === "publish" || (input.action === "plan" && !input.paused)) && input.limits
        ? {
            limits: {
              monthlyBytes: input.limits.monthlyBytes,
              monthlyAwakeSeconds: input.limits.monthlyAwakeSeconds,
              uploadBytes: input.limits.uploadBytes,
              appBytes: input.limits.appBytes,
            },
          }
        : {}),
      jti: randomBytes(18).toString("base64url"),
      iat: now,
      exp: now + DEPLOY_TICKET_TTL_SECONDS,
    },
    secret,
  );
}

/** The gateway's address for ordinary requests, from the one browsers connect to (wss → https). */
export function gatewayHttpUrl(gatewayUrl: string): string {
  const url = new URL(gatewayUrl);
  return `${url.protocol === "ws:" ? "http:" : "https:"}//${url.host}`;
}

/**
 * SHA-256 of the token a task's sandbox requires of whoever connects to it.
 *
 * The sandbox is started with this hash, the gateway derives the token itself when it connects,
 * and the token is stored nowhere: nothing the agent runs can read it off its own machine.
 */
export function sandboxTokenSha256(sandboxTokenSecret: string, taskId: string): string {
  const token = createHmac("sha256", sandboxTokenSecret)
    .update(`sandbox:${taskId}`)
    .digest("base64url");
  return createHash("sha256").update(token).digest("hex");
}

/**
 * SHA-256 of the token a published app's machine requires of whoever calls it. The same scheme
 * as a sandbox's, under a different label, so that neither token opens the other.
 */
export function siteTokenSha256(sandboxTokenSecret: string, taskId: string): string {
  const token = createHmac("sha256", sandboxTokenSecret).update(`site:${taskId}`).digest("base64url");
  return createHash("sha256").update(token).digest("hex");
}

/* ---------------------------------------------------------------------------
   A project's environment variables
   --------------------------------------------------------------------------- */

export type TensorCloudVariable = { name: string; value: string };

export const MAX_VARIABLES = 100;
export const MAX_VARIABLE_NAME = 128;
/** One value: long enough for a certificate or a service account's key file. */
export const MAX_VARIABLE_VALUE = 16 * 1024;

/** A name an environment can hold: letters, digits and underscores, not starting with a digit. */
const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
/**
 * Names that are not a project's to set. The machines its app and its preview run on give these
 * their meaning, and an app that could change them could be told to load other code or look for
 * its data somewhere else.
 */
const RESERVED_VARIABLES = new Set(["PORT", "HOST", "HOME", "PATH", "DATA_DIR", "NODE_OPTIONS", "LD_PRELOAD", "LD_LIBRARY_PATH"]);

/**
 * A set of variables as it may be saved, or the reason it may not be. Order is kept. Nothing is
 * tidied: a value is a secret, and one that is quietly changed is one that no longer works.
 */
export function normalizeVariables(input: unknown): { ok: true; variables: TensorCloudVariable[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "That is not a list of variables." };
  if (input.length > MAX_VARIABLES) return { ok: false, error: `A project can have ${MAX_VARIABLES} variables at most.` };
  const seen = new Set<string>();
  const variables: TensorCloudVariable[] = [];
  for (const item of input) {
    const name = (item as { name?: unknown } | null)?.name;
    const value = (item as { value?: unknown } | null)?.value;
    if (typeof name !== "string" || typeof value !== "string") return { ok: false, error: "Every variable needs a name and a value." };
    if (!VARIABLE_NAME.test(name) || name.length > MAX_VARIABLE_NAME) {
      return { ok: false, error: `"${name.slice(0, 40)}" is not a name a variable can have: use letters, digits and underscores, not starting with a digit.` };
    }
    if (RESERVED_VARIABLES.has(name.toUpperCase()) || /^(TENSOR|SITE)_/i.test(name)) {
      return { ok: false, error: `${name} is set by Tensor and cannot be changed.` };
    }
    if (seen.has(name)) return { ok: false, error: `${name} is there twice.` };
    if (value.length > MAX_VARIABLE_VALUE || value.includes("\0")) return { ok: false, error: `The value of ${name} is too long.` };
    seen.add(name);
    variables.push({ name, value });
  }
  return { ok: true, variables };
}

/** The key one project's variables are sealed with. Never stored: derived when it is needed. */
function variablesKey(secret: string, taskId: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, taskId, "tensor-cloud-variables", 32));
}

/**
 * Seals a project's variables for the database: AES-256-GCM, under a key derived from a secret
 * only this app holds and from the project's id, so one project's row cannot be opened as
 * another's and the table by itself gives nothing away.
 */
export function sealVariables(variables: TensorCloudVariable[], secret: string, taskId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", variablesKey(secret, taskId), iv);
  const sealed = Buffer.concat([cipher.update(JSON.stringify(variables), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), sealed.toString("base64url")].join(":");
}

/** Opens what sealVariables made, or null when it is not that, or was changed, or is another project's. */
export function openVariables(sealed: string, secret: string, taskId: string): TensorCloudVariable[] | null {
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", variablesKey(secret, taskId), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const text = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
    const opened = normalizeVariables(JSON.parse(text));
    return opened.ok ? opened.variables : null;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
   GitHub: signing in, and the tokens that come of it
   --------------------------------------------------------------------------- */

/** The places Tensor on the web is served from: the only ones a sign-in may return to. */
const TENSOR_SITE_ORIGINS = ["https://tensorade.app", "https://www.tensorade.app"];
const TENSOR_DEV_ORIGINS = ["http://127.0.0.1:3000", "http://localhost:3000"];

/** A site origin that a GitHub sign-in may return to, or null. Local ones only outside production. */
export function tensorSiteOrigin(value: unknown, production: boolean = process.env.NODE_ENV === "production"): string | null {
  if (typeof value !== "string") return null;
  const origin = value.trim().replace(/\/+$/, "");
  if (TENSOR_SITE_ORIGINS.includes(origin)) return origin;
  return !production && TENSOR_DEV_ORIGINS.includes(origin) ? origin : null;
}

/** A path on the site to return to: one that begins with a single slash, and nothing else. */
export function tensorSitePath(value: unknown): string {
  if (typeof value !== "string" || value.length > 300) return "/chat";
  return /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?]*$/.test(value) ? value : "/chat";
}

const GITHUB_STATE_AUDIENCE = "tensor-cloud-github";
/** Long enough to sign in to GitHub and choose repositories; short enough to be of no use later. */
export const GITHUB_STATE_TTL_SECONDS = 20 * 60;

export type GithubState = { userId: string; site: string; path: string };

/**
 * What goes to GitHub with a person who is signing in, and comes back with them: who they are
 * here and where to return them. Signed, so that what comes back is what was sent; the page
 * they return to still checks that it is the same person, signed in, in the same browser.
 */
export function signGithubState(input: GithubState, secret: string, now: number = Math.floor(Date.now() / 1000)): string {
  return signJwt(
    { aud: GITHUB_STATE_AUDIENCE, sub: input.userId, site: input.site, path: input.path, iat: now, exp: now + GITHUB_STATE_TTL_SECONDS },
    secret,
  );
}

export function verifyGithubState(token: unknown, secret: string, now: number = Math.floor(Date.now() / 1000)): GithubState | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  const claims = verifyJwt(token, secret);
  if (!claims || claims.aud !== GITHUB_STATE_AUDIENCE) return null;
  const { sub, site, path, exp } = claims;
  if (typeof sub !== "string" || !sub || typeof exp !== "number" || exp <= now) return null;
  const origin = tensorSiteOrigin(site);
  if (!origin) return null;
  return { userId: sub, site: origin, path: tensorSitePath(path) };
}

const SUPABASE_STATE_AUDIENCE = "tensor-supabase";
const SUPABASE_STATE_TTL_SECONDS = 20 * 60;

export type SupabaseState = { userId: string; site: string; path: string; nonce: string };

/**
 * What goes to Supabase with a person connecting their account, and comes back with them: who
 * they are here, where to return them, and a nonce the PKCE verifier is worked out from (here,
 * from the secret: it never leaves this server). Signed, as GitHub's is.
 */
export function signSupabaseState(
  input: Omit<SupabaseState, "nonce">,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): { state: string; nonce: string } {
  const nonce = randomBytes(18).toString("base64url");
  const state = signJwt(
    { aud: SUPABASE_STATE_AUDIENCE, sub: input.userId, site: input.site, path: input.path, jti: nonce, iat: now, exp: now + SUPABASE_STATE_TTL_SECONDS },
    secret,
  );
  return { state, nonce };
}

export function verifySupabaseState(token: unknown, secret: string, now: number = Math.floor(Date.now() / 1000)): SupabaseState | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  const claims = verifyJwt(token, secret);
  if (!claims || claims.aud !== SUPABASE_STATE_AUDIENCE) return null;
  const { sub, site, path, jti, exp } = claims;
  if (typeof sub !== "string" || !sub || typeof jti !== "string" || !jti || typeof exp !== "number" || exp <= now) return null;
  const origin = tensorSiteOrigin(site);
  if (!origin) return null;
  return { userId: sub, site: origin, path: tensorSitePath(path), nonce: jti };
}

/** The PKCE verifier for a sign-in, from its nonce: the same each time, and known only here. */
export function supabaseCodeVerifier(nonce: string, secret: string): string {
  return createHmac("sha256", secret).update(`tensor-supabase-pkce:${nonce}`).digest("base64url");
}

export function supabaseCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Seals something of a person's for the database (their Supabase tokens), keyed to them. */
export function sealForUser(value: unknown, secret: string, userId: string, purpose: string): string {
  const key = Buffer.from(hkdfSync("sha256", secret, userId, purpose, 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const sealed = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), sealed.toString("base64url")].join(":");
}

export function openForUser(sealed: string, secret: string, userId: string, purpose: string): unknown {
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const key = Buffer.from(hkdfSync("sha256", secret, userId, purpose, 32));
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

/** A person's tokens for GitHub, as GitHub gave them. Times are seconds since 1970. */
export type GithubTokens = {
  accessToken: string;
  /** When the access token stops working. Null for one that does not expire. */
  accessExpiresAt: number | null;
  refreshToken: string | null;
  refreshExpiresAt: number | null;
  /** The app the tokens were issued to. Absent on ones from before Tensor had an app of its own. */
  clientId?: string;
};

function githubKey(secret: string, userId: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, userId, "tensor-cloud-github", 32));
}

/** Seals a person's GitHub tokens for the database, as sealVariables does a project's variables. */
export function sealGithubTokens(tokens: GithubTokens, secret: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", githubKey(secret, userId), iv);
  const sealed = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), sealed.toString("base64url")].join(":");
}

export function openGithubTokens(sealed: string, secret: string, userId: string): GithubTokens | null {
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", githubKey(secret, userId), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const value = JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8"));
    if (typeof value?.accessToken !== "string" || !value.accessToken) return null;
    const time = (one: unknown) => (typeof one === "number" && Number.isFinite(one) ? one : null);
    return {
      accessToken: value.accessToken,
      accessExpiresAt: time(value.accessExpiresAt),
      refreshToken: typeof value.refreshToken === "string" && value.refreshToken ? value.refreshToken : null,
      refreshExpiresAt: time(value.refreshExpiresAt),
      ...(typeof value.clientId === "string" && value.clientId ? { clientId: value.clientId } : {}),
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
   Task tokens
   --------------------------------------------------------------------------- */

export const TASK_TOKEN_PREFIX = "tct_";
const TASK_TOKEN_AUDIENCE = "tensor-cloud-task";
/**
 * Ten years: in effect, for as long as the task exists. A sandbox is given its token once, when
 * its machine is created, and a chat can be picked up again weeks later; a token that expired on
 * the clock would leave it unable to think. What ends a token is its task: the proxy honours one
 * only while the task's row is ready (see authenticateTensorCloudTask), and only during a turn
 * the account has reserved.
 */
export const TASK_TOKEN_TTL_SECONDS = 10 * 365 * 24 * 60 * 60;

export type TaskTokenClaims = { userId: string; taskId: string; expiresAt: number };

/**
 * What a sandbox authenticates its model calls with, in place of the user's session.
 *
 * A sandbox runs untrusted code beside this credential, so assume it leaks. It is built to be
 * worth little when it does: it is good for model calls only, only for the account that owns the
 * task, only while that task is still running (the caller checks the task's row), and only while
 * the account has a turn reserved, exactly as on the desktop. It cannot read the account, change
 * billing, or start anything.
 */
export function signTaskToken(
  input: { userId: string; taskId: string },
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): string {
  return (
    TASK_TOKEN_PREFIX +
    signJwt(
      {
        aud: TASK_TOKEN_AUDIENCE,
        sub: input.userId,
        task: input.taskId,
        iat: now,
        exp: now + TASK_TOKEN_TTL_SECONDS,
      },
      secret,
    )
  );
}

/**
 * Whether a bearer is shaped like a task token. The inference proxy sends everything else to the
 * ordinary session check, so this must never claim a session token: the prefix alone could, by
 * chance, begin one, but a session token has no dots and a signed token always has two.
 */
export function isTaskToken(token: string): boolean {
  return token.startsWith(TASK_TOKEN_PREFIX) && token.split(".").length === 3;
}

/** The token's claims when it is one this app signed and it has not expired; otherwise null. */
export function verifyTaskToken(
  token: string,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): TaskTokenClaims | null {
  if (!isTaskToken(token) || token.length > 2048) return null;
  const claims = verifyJwt(token.slice(TASK_TOKEN_PREFIX.length), secret);
  if (!claims || claims.aud !== TASK_TOKEN_AUDIENCE) return null;
  const { sub, task, exp } = claims;
  if (typeof sub !== "string" || !sub || typeof task !== "string" || !task) return null;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= now) return null;
  return { userId: sub, taskId: task, expiresAt: exp };
}

/* ---------------------------------------------------------------------------
   Who may use it
   --------------------------------------------------------------------------- */

export type TensorCloudAccess = {
  /** May start and run cloud tasks at all. */
  tasks: boolean;
  /** May run them against private repositories. */
  privateRepositories: boolean;
  /** How many published apps with a server of their own the account may have live at once. */
  backendApps: number;
  /** What each of those apps may use. Null when the plan includes none. */
  site: SiteAllowance | null;
};

/** What one published app may use in a month, and how large it may be. */
export type SiteAllowance = {
  /** The size of its disk, which holds its code and its live data. */
  volumeGb: number;
  /**
   * What the account's sites and apps may send to visitors in a calendar month, between them.
   * Sites cost nothing to keep, but what they send is billed like an app's, so they share it.
   */
  monthlyBytes: number;
  /** How long its machine may run in a calendar month. It only runs while it is being visited. */
  monthlyAwakeSeconds: number;
  /** The app as sent (packed), and as it unpacks. */
  uploadBytes: number;
  appBytes: number;
};

const MB = 1024 ** 2;
const GB = 1024 ** 3;
const HOUR = 3600;

/**
 * A static site costs nothing to keep, but what it sends is billed. An app with a server is a
 * machine, a disk and the data it sends, all billed to Cencori for as long as it stays published.
 * So every plan's allowance is sized from what it can cost at its most, and an app that outgrows
 * it needs a larger plan. Data is the account's: its sites and its apps share one monthly amount.
 *
 * The three smaller plans are each held under a dollar a month at the very most, with every
 * allowance used up. Worked from Fly's prices in Johannesburg, taken as: disk $0.15 per GB, the
 * stopped machine's image about $0.10, the smallest machine about $0.0044 an hour while it runs
 * (about $3.20 a month if it never slept), data sent $0.12 per GB.
 *
 *   starter  1 app   1 GB disk   50 h each   1 GB sent     0.25 + 0.22 + 0.12 = $0.59
 *   builder  1 app   1 GB disk   80 h each   2 GB sent     0.25 + 0.35 + 0.24 = $0.84
 *   pro      1 app   1 GB disk  100 h each   2.5 GB sent   0.25 + 0.44 + 0.30 = $0.99
 *   max      3 apps  2 GB disk  200 h each   15 GB sent    3 x (0.40 + 0.88) + 1.80 = $5.64
 *   ultra    5 apps  2 GB disk  always on    50 GB sent    5 x (0.40 + 3.20) + 6.00 = $24.00
 *
 * The rule, and the working, are the Tensor repo's cloud/PRICING.md. If Fly's prices or the
 * region change, these are the numbers to work out again.
 */
const SITE_ALLOWANCES: Record<string, { apps: number; site: SiteAllowance }> = {
  starter: { apps: 1, site: { volumeGb: 1, monthlyBytes: 1 * GB, monthlyAwakeSeconds: 50 * HOUR, uploadBytes: 40 * MB, appBytes: 150 * MB } },
  builder: { apps: 1, site: { volumeGb: 1, monthlyBytes: 2 * GB, monthlyAwakeSeconds: 80 * HOUR, uploadBytes: 60 * MB, appBytes: 250 * MB } },
  pro: { apps: 1, site: { volumeGb: 1, monthlyBytes: 2.5 * GB, monthlyAwakeSeconds: 100 * HOUR, uploadBytes: 80 * MB, appBytes: 300 * MB } },
  max: { apps: 3, site: { volumeGb: 2, monthlyBytes: 15 * GB, monthlyAwakeSeconds: 200 * HOUR, uploadBytes: 150 * MB, appBytes: 600 * MB } },
  ultra: { apps: 5, site: { volumeGb: 2, monthlyBytes: 50 * GB, monthlyAwakeSeconds: 744 * HOUR, uploadBytes: 150 * MB, appBytes: 600 * MB } },
  enterprise: { apps: 5, site: { volumeGb: 2, monthlyBytes: 50 * GB, monthlyAwakeSeconds: 744 * HOUR, uploadBytes: 150 * MB, appBytes: 600 * MB } },
};

const PRIVATE_REPOSITORY_PLANS = new Set(["pro", "max", "ultra", "enterprise"]);

/**
 * What a plan includes of Tensor in the cloud.
 *
 * A sandbox is a computer rented by the second, and that bill is Cencori's whatever the task
 * does, so the trial does not include one: it is a paid feature from the first plan up. Private
 * repositories start at Pro.
 *
 * `planCode` is the account's effective plan (effectiveTensorPlan), where "free" is the trial and
 * a lapsed paid plan has already fallen back to it.
 */
export function tensorCloudAccess(planCode: string): TensorCloudAccess {
  const paid = ["starter", "builder", "pro", "max", "ultra", "enterprise"].includes(planCode);
  return {
    tasks: paid,
    privateRepositories: paid && PRIVATE_REPOSITORY_PLANS.has(planCode),
    backendApps: paid ? (SITE_ALLOWANCES[planCode]?.apps ?? 0) : 0,
    site: paid ? (SITE_ALLOWANCES[planCode]?.site ?? null) : null,
  };
}

/* ---------------------------------------------------------------------------
   Repositories
   --------------------------------------------------------------------------- */

/**
 * The repository a task may clone, as the one canonical URL it will be cloned by, or null.
 *
 * Only public GitHub repositories over HTTPS for now. The value is handed to `git clone` inside
 * the sandbox, so it is rebuilt from the two parts that matter rather than passed through: no
 * credentials, ports, query strings, other hosts or other schemes survive.
 */
export function normalizeRepositoryUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
  if (url.username || url.password || url.port || url.search || url.hash) return null;
  const match = /^\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/.exec(
    url.pathname,
  );
  if (!match) return null;
  const [, owner, name] = match as unknown as [string, string, string];
  if (name === "." || name === "..") return null;
  return `https://github.com/${owner}/${name}.git`;
}

/**
 * What a task is listed as: the start of its first message, on one line. Null when there is
 * nothing usable, in which case the task is simply untitled.
 */
export function normalizeTaskTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.replace(/\s+/g, " ").trim();
  if (!title) return null;
  return title.length > 80 ? `${title.slice(0, 79).trimEnd()}…` : title;
}

/**
 * A project's name as its owner typed it, tidied: one line, at most 60 characters. Null when it
 * is empty, which the caller reads as "not a project".
 */
export function normalizeProjectName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  if (!name) return null;
  return name.slice(0, 60).trimEnd();
}

/** A branch or tag name safe to hand to `git clone --branch`, or null. */
export function normalizeRepositoryRef(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ref = value.trim();
  if (!ref || ref.length > 200) return null;
  // Git's own rules, tightened: nothing that could be read as an option or a path escape.
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref)) return null;
  if (ref.includes("..") || ref.includes("//") || ref.endsWith("/") || ref.endsWith(".lock")) {
    return null;
  }
  return ref;
}

/* ---------------------------------------------------------------------------
   Machines
   --------------------------------------------------------------------------- */

/** What a sandbox gets to work with. Enough to install and test an ordinary repository. */
export const SANDBOX_GUEST = { cpu_kind: "shared", cpus: 2, memory_mb: 4096 } as const;

/**
 * The size of a task's volume. A machine's own disk is rebuilt from the image every time it
 * starts, so the repository, what the agent changed in it and the conversation live here. It is
 * billed for as long as the task is kept, running or not.
 */
export const SANDBOX_VOLUME_GB = 5;
/** Where the sandbox image expects the volume (TENSOR_DATA_DIR in its entrypoint). */
const SANDBOX_VOLUME_PATH = "/data";

/** Fly volume names are short and alphanumeric; the task id, shortened, still identifies it. */
export function sandboxVolumeName(taskId: string): string {
  return `task_${taskId.replace(/-/g, "").slice(0, 24)}`;
}

/** The body of Fly's "create machine" call for one task. */
export function sandboxMachineRequest(
  input: {
    taskId: string;
    userId: string;
    volumeId: string;
    /** Null starts the task in an empty workspace: something new, built from nothing. */
    repositoryUrl: string | null;
    repositoryRef: string | null;
    /**
     * False creates the machine without starting it: a spare, made ahead of time so that the
     * chat that claims it only has to start a machine, not wait for one to be built.
     */
    launch?: boolean;
  },
  config: TensorCloudConfig,
  now?: number,
) {
  return {
    name: `task-${input.taskId}`,
    region: config.sandboxRegion,
    ...(input.launch === false ? { skip_launch: true } : {}),
    config: {
      image: config.sandboxImage,
      guest: SANDBOX_GUEST,
      // A sandbox that exits has finished or failed; either way it is not to come back by itself
      // and run up a bill. It is started again only when its owner returns to the task.
      restart: { policy: "no" },
      auto_destroy: false,
      mounts: [{ volume: input.volumeId, path: SANDBOX_VOLUME_PATH }],
      env: {
        ...(input.repositoryUrl ? { REPO_URL: input.repositoryUrl } : {}),
        ...(input.repositoryUrl && input.repositoryRef ? { REPO_REF: input.repositoryRef } : {}),
        CENCORI_TOKEN: signTaskToken(input, config.taskTokenSecret, now),
        TENSOR_WS_TOKEN_SHA256: sandboxTokenSha256(config.sandboxTokenSecret, input.taskId),
      },
      // No `services`: a sandbox has no public address. Only the gateway reaches it, over the
      // organisation's private network.
      metadata: { tensor_task: input.taskId, tensor_user: input.userId },
    },
  };
}

/**
 * What a published app runs on: the smallest machine there is. It sleeps when nobody is visiting
 * (it stops itself, and the gateway starts it), so most of what it costs is its disk.
 */
export const SITE_GUEST = { cpu_kind: "shared", cpus: 1, memory_mb: 256 } as const;

export function siteVolumeName(taskId: string): string {
  return `site_${taskId.replace(/-/g, "").slice(0, 24)}`;
}

/** The body of Fly's "create machine" call for one project's published app. */
export function siteMachineRequest(
  input: { taskId: string; userId: string; volumeId: string },
  config: TensorCloudConfig,
) {
  return {
    name: `site-${input.taskId}`,
    region: config.sitesRegion,
    config: {
      image: config.sitesImage,
      guest: SITE_GUEST,
      // Memory to fall back on: an app's start can need more than it does once it is running.
      init: { swap_size_mb: 512 },
      // It exits when it has been idle, and that is meant to stop it. The gateway starts it.
      restart: { policy: "no" },
      auto_destroy: false,
      mounts: [{ volume: input.volumeId, path: "/data" }],
      env: { SITE_TOKEN_SHA256: siteTokenSha256(config.sandboxTokenSecret, input.taskId) },
      // No `services`: an app has no public address of its own. The gateway is the way in.
      metadata: { tensor_task: input.taskId, tensor_user: input.userId, tensor_site: "1" },
    },
  };
}

export type FlyMachine = { id: string; state: string; region: string; config?: { image?: string } };
export type FlyVolume = { id: string; region: string };

export type FlyResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const FLY_API = "https://api.machines.dev/v1";

/** Fly's Machines API, for one app: the sandboxes' unless said otherwise (see sitesFly). */
export class FlyMachines {
  readonly #config: TensorCloudConfig;
  readonly #fetch: typeof fetch;
  readonly #app: string;
  readonly #token: string;

  constructor(
    config: TensorCloudConfig,
    fetcher: typeof fetch = fetch,
    target: { app: string; token: string } = { app: config.sandboxApp, token: config.flyApiToken },
  ) {
    this.#config = config;
    this.#fetch = fetcher;
    this.#app = target.app;
    this.#token = target.token;
  }

  async #call<T>(method: string, path: string, body?: unknown): Promise<FlyResult<T>> {
    let response: Response;
    try {
      response = await this.#fetch(
        `${FLY_API}/apps/${encodeURIComponent(this.#app)}${path}`,
        {
          method,
          headers: {
            authorization: `Bearer ${this.#token}`,
            ...(body === undefined ? {} : { "content-type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        },
      );
    } catch (error) {
      return { ok: false, status: 0, error: error instanceof Error ? error.message : "unreachable" };
    }
    const text = await response.text().catch(() => "");
    if (!response.ok) return { ok: false, status: response.status, error: text.slice(0, 300) };
    try {
      return { ok: true, value: (text ? JSON.parse(text) : null) as T };
    } catch {
      return { ok: false, status: response.status, error: "Fly returned an unreadable response." };
    }
  }

  createVolume(taskId: string): Promise<FlyResult<FlyVolume>> {
    return this.#call<FlyVolume>("POST", "/volumes", {
      name: sandboxVolumeName(taskId),
      region: this.#config.sandboxRegion,
      size_gb: SANDBOX_VOLUME_GB,
    });
  }

  /** The disk of a published app: its code, its dependencies and its live data. */
  createSiteVolume(taskId: string, sizeGb: number): Promise<FlyResult<FlyVolume>> {
    return this.#call<FlyVolume>("POST", "/volumes", {
      name: siteVolumeName(taskId),
      region: this.#config.sitesRegion,
      size_gb: sizeGb,
    });
  }

  /** Everything the task held goes with it. The volume must no longer be attached to a machine. */
  destroyVolume(volumeId: string): Promise<FlyResult<unknown>> {
    return this.#call("DELETE", `/volumes/${encodeURIComponent(volumeId)}`);
  }

  create(
    request: ReturnType<typeof sandboxMachineRequest> | ReturnType<typeof siteMachineRequest>,
  ): Promise<FlyResult<FlyMachine>> {
    return this.#call<FlyMachine>("POST", "/machines", request);
  }

  get(machineId: string): Promise<FlyResult<FlyMachine>> {
    return this.#call<FlyMachine>("GET", `/machines/${encodeURIComponent(machineId)}`);
  }

  /**
   * Replaces a machine's configuration (its image, say), keeping its disk. It restarts with it,
   * unless `skipLaunch` leaves it stopped.
   */
  update(machineId: string, request: { config: unknown; skipLaunch?: boolean }): Promise<FlyResult<FlyMachine>> {
    return this.#call<FlyMachine>("POST", `/machines/${encodeURIComponent(machineId)}`, {
      config: request.config,
      ...(request.skipLaunch ? { skip_launch: true } : {}),
    });
  }

  start(machineId: string): Promise<FlyResult<unknown>> {
    return this.#call("POST", `/machines/${encodeURIComponent(machineId)}/start`);
  }

  stop(machineId: string): Promise<FlyResult<unknown>> {
    return this.#call("POST", `/machines/${encodeURIComponent(machineId)}/stop`);
  }

  /** Resolves once the machine reports the state, or fails after Fly's own wait limit. */
  waitFor(machineId: string, state: "started" | "stopped"): Promise<FlyResult<unknown>> {
    return this.#call(
      "GET",
      `/machines/${encodeURIComponent(machineId)}/wait?state=${state}&timeout=30`,
    );
  }

  /** Forced: a task being deleted may still be running, and it must not outlive its row. */
  destroy(machineId: string): Promise<FlyResult<unknown>> {
    return this.#call("DELETE", `/machines/${encodeURIComponent(machineId)}?force=true`);
  }
}

/** Fly's Machines API for the app that holds published apps' machines. */
export function sitesFly(config: TensorCloudConfig, fetcher: typeof fetch = fetch): FlyMachines {
  return new FlyMachines(config, fetcher, { app: config.sitesApp, token: config.sitesFlyApiToken });
}

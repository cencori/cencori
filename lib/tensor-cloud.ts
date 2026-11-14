import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

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

/* ---------------------------------------------------------------------------
   Task tokens
   --------------------------------------------------------------------------- */

export const TASK_TOKEN_PREFIX = "tct_";
const TASK_TOKEN_AUDIENCE = "tensor-cloud-task";
/** Past any task's life. The token dies with its task long before this; see verifyTaskToken. */
export const TASK_TOKEN_TTL_SECONDS = 24 * 60 * 60;

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
  return { tasks: paid, privateRepositories: paid && PRIVATE_REPOSITORY_PLANS.has(planCode) };
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
  },
  config: TensorCloudConfig,
  now?: number,
) {
  return {
    name: `task-${input.taskId}`,
    region: config.sandboxRegion,
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

export type FlyMachine = { id: string; state: string; region: string };
export type FlyVolume = { id: string; region: string };

export type FlyResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const FLY_API = "https://api.machines.dev/v1";

/** Fly's Machines API, for the sandbox app only. */
export class FlyMachines {
  readonly #config: TensorCloudConfig;
  readonly #fetch: typeof fetch;

  constructor(config: TensorCloudConfig, fetcher: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetcher;
  }

  async #call<T>(method: string, path: string, body?: unknown): Promise<FlyResult<T>> {
    let response: Response;
    try {
      response = await this.#fetch(
        `${FLY_API}/apps/${encodeURIComponent(this.#config.sandboxApp)}${path}`,
        {
          method,
          headers: {
            authorization: `Bearer ${this.#config.flyApiToken}`,
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

  /** Everything the task held goes with it. The volume must no longer be attached to a machine. */
  destroyVolume(volumeId: string): Promise<FlyResult<unknown>> {
    return this.#call("DELETE", `/volumes/${encodeURIComponent(volumeId)}`);
  }

  create(request: ReturnType<typeof sandboxMachineRequest>): Promise<FlyResult<FlyMachine>> {
    return this.#call<FlyMachine>("POST", "/machines", request);
  }

  get(machineId: string): Promise<FlyResult<FlyMachine>> {
    return this.#call<FlyMachine>("GET", `/machines/${encodeURIComponent(machineId)}`);
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

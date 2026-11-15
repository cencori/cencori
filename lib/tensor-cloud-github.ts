import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  type GithubTokens,
  openGithubTokens,
  sealGithubTokens,
  type TensorCloudConfig,
} from "@/lib/tensor-cloud";

/**
 * GitHub for Tensor in the cloud: pushing what a project built to a repository.
 *
 * It goes through Cencori's GitHub App, which a person installs on the accounts and repositories
 * they choose. Two things are kept apart here, on purpose:
 *
 * - Who may push where is always GitHub's answer, asked with the person's own token. The app
 *   being installed on a repository says nothing about whether this person may push to it, and
 *   nothing recorded here is taken as saying so: the question is asked again before a project is
 *   connected and before every push.
 * - What pushes is a token for the app's installation, limited to the one repository and to its
 *   contents, good for an hour. The person's own token never leaves this server.
 */

type Admin = ReturnType<typeof createAdminClient>;

const ACCOUNTS = "tensor_cloud_github_accounts";
const CONNECTIONS = "tensor_cloud_git";
const API = "https://api.github.com";

export type GithubApp = { clientId: string; clientSecret: string; slug: string };

/** The app's sign-in credentials, or null where it is not set up. */
export function readGithubApp(env: Record<string, string | undefined> = process.env): GithubApp | null {
  const clientId = env.GITHUB_APP_CLIENT_ID?.trim() || "";
  const clientSecret = env.GITHUB_APP_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, slug: env.NEXT_PUBLIC_GITHUB_APP_SLUG?.trim() || "cencori" };
}

export type GithubRepository = {
  id: number;
  /** "owner/name". */
  fullName: string;
  private: boolean;
  defaultBranch: string;
};

export type GitConnection = {
  task_id: string;
  user_id: string;
  repository_id: number;
  repository: string;
  branch: string;
  private: boolean;
  connected_at: string;
  last_pushed_at: string | null;
};

export function connectionJson(connection: GitConnection) {
  return {
    repository: connection.repository,
    branch: connection.branch,
    private: connection.private,
    connectedAt: connection.connected_at,
    lastPushedAt: connection.last_pushed_at,
  };
}

/* ---------------------------------------------------------------------------
   Tokens
   --------------------------------------------------------------------------- */

type TokenAnswer = {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  refresh_token_expires_in?: unknown;
  error?: unknown;
};

function tokensFrom(answer: TokenAnswer, now: number): GithubTokens | null {
  if (typeof answer.access_token !== "string" || !answer.access_token) return null;
  const after = (seconds: unknown) => (typeof seconds === "number" && seconds > 0 ? now + seconds : null);
  return {
    accessToken: answer.access_token,
    accessExpiresAt: after(answer.expires_in),
    refreshToken: typeof answer.refresh_token === "string" && answer.refresh_token ? answer.refresh_token : null,
    refreshExpiresAt: after(answer.refresh_token_expires_in),
  };
}

async function askForTokens(app: GithubApp, body: Record<string, string>, fetcher: typeof fetch): Promise<GithubTokens | null> {
  try {
    const response = await fetcher("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ client_id: app.clientId, client_secret: app.clientSecret, ...body }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    return tokensFrom((await response.json()) as TokenAnswer, Math.floor(Date.now() / 1000));
  } catch {
    return null;
  }
}

/** Turns the code GitHub sends a person back with into their tokens. */
export function exchangeGithubCode(app: GithubApp, code: string, redirectUri: string | null, fetcher: typeof fetch = fetch) {
  return askForTokens(app, { code, ...(redirectUri ? { redirect_uri: redirectUri } : {}) }, fetcher);
}

/* ---------------------------------------------------------------------------
   Asking GitHub, as the person
   --------------------------------------------------------------------------- */

async function github<T>(token: string, path: string, fetcher: typeof fetch): Promise<{ ok: true; value: T } | { ok: false; status: number }> {
  try {
    const response = await fetcher(`${API}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

type RawRepository = {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  archived?: boolean;
  permissions?: { push?: boolean };
};

const repository = (raw: RawRepository): GithubRepository => ({
  id: raw.id,
  fullName: raw.full_name,
  private: Boolean(raw.private),
  defaultBranch: raw.default_branch || "main",
});

/** Who a token belongs to on GitHub. */
export async function githubViewer(token: string, fetcher: typeof fetch = fetch): Promise<{ id: number; login: string } | null> {
  const viewer = await github<{ id: number; login: string }>(token, "/user", fetcher);
  return viewer.ok && typeof viewer.value.id === "number" && typeof viewer.value.login === "string"
    ? { id: viewer.value.id, login: viewer.value.login }
    : null;
}

/** How many repositories are listed at most: enough for anyone, and a bound on the asking. */
const MAX_LISTED = 500;

/**
 * Every repository this person can push to through the app: the ones the app is installed on,
 * narrowed by GitHub to those the person can reach, narrowed here to those they may push to.
 */
export async function listPushableRepositories(token: string, fetcher: typeof fetch = fetch): Promise<GithubRepository[] | null> {
  const installations = await github<{ installations: { id: number }[] }>(token, "/user/installations?per_page=100", fetcher);
  if (!installations.ok) return null;
  const found: GithubRepository[] = [];
  for (const installation of installations.value.installations ?? []) {
    for (let page = 1; page <= 5 && found.length < MAX_LISTED; page++) {
      const listed = await github<{ repositories: RawRepository[] }>(
        token,
        `/user/installations/${installation.id}/repositories?per_page=100&page=${page}`,
        fetcher,
      );
      if (!listed.ok) break;
      const batch = listed.value.repositories ?? [];
      for (const raw of batch) if (raw.permissions?.push && !raw.archived) found.push(repository(raw));
      if (batch.length < 100) break;
    }
  }
  return found.sort((a, b) => a.fullName.localeCompare(b.fullName)).slice(0, MAX_LISTED);
}

/**
 * One repository, if this person may push to it through the app right now. Null when they may
 * not, for any reason: it is gone, the app was taken off it, they lost access.
 */
export async function pushableRepository(token: string, repositoryId: number, fetcher: typeof fetch = fetch): Promise<GithubRepository | null> {
  const found = await github<RawRepository>(token, `/repositories/${repositoryId}`, fetcher);
  if (!found.ok || !found.value.permissions?.push || found.value.archived) return null;
  return repository(found.value);
}

/* ---------------------------------------------------------------------------
   The person's account
   --------------------------------------------------------------------------- */

export type GithubAccount = { login: string; githubUserId: number };

export async function saveGithubAccount(
  admin: Admin,
  config: TensorCloudConfig,
  userId: string,
  viewer: { id: number; login: string },
  tokens: GithubTokens,
): Promise<void> {
  const { error } = await admin.from(ACCOUNTS).upsert(
    {
      user_id: userId,
      github_user_id: viewer.id,
      github_login: viewer.login,
      sealed: sealGithubTokens(tokens, config.taskTokenSecret, userId),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

/** Signs a person out of GitHub here, and disconnects every project of theirs with it. */
export async function forgetGithubAccount(admin: Admin, userId: string): Promise<void> {
  const connections = await admin.from(CONNECTIONS).delete().eq("user_id", userId);
  if (connections.error) throw connections.error;
  const { error } = await admin.from(ACCOUNTS).delete().eq("user_id", userId);
  if (error) throw error;
}

/**
 * The GitHub account a person signed in with, and a token for it that works now, got anew from
 * GitHub when the one on record has run out. `token` is null when it cannot be had any more
 * (the sign-in was revoked on GitHub, or lapsed): they have to sign in again.
 */
export async function readGithubAccount(
  admin: Admin,
  config: TensorCloudConfig,
  app: GithubApp,
  userId: string,
  fetcher: typeof fetch = fetch,
): Promise<(GithubAccount & { token: string | null }) | null> {
  const { data, error } = await admin.from(ACCOUNTS).select("github_user_id, github_login, sealed").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { github_user_id: number; github_login: string; sealed: string };
  const account = { login: row.github_login, githubUserId: Number(row.github_user_id) };
  const tokens = openGithubTokens(row.sealed, config.taskTokenSecret, userId);
  if (!tokens) return { ...account, token: null };

  const now = Math.floor(Date.now() / 1000);
  // A minute's margin: a token about to run out is of no use to a request about to be made.
  if (!tokens.accessExpiresAt || tokens.accessExpiresAt - 60 > now) return { ...account, token: tokens.accessToken };
  if (!tokens.refreshToken || (tokens.refreshExpiresAt && tokens.refreshExpiresAt <= now)) return { ...account, token: null };

  const renewed = await askForTokens(app, { grant_type: "refresh_token", refresh_token: tokens.refreshToken }, fetcher);
  if (!renewed) return { ...account, token: null };
  // A refresh token works once: the new pair has to be on record before it is used.
  const saved = await admin
    .from(ACCOUNTS)
    .update({ sealed: sealGithubTokens(renewed, config.taskTokenSecret, userId), updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (saved.error) throw saved.error;
  return { ...account, token: renewed.accessToken };
}

/* ---------------------------------------------------------------------------
   A project's repository
   --------------------------------------------------------------------------- */

export async function readGitConnection(admin: Admin, taskId: string): Promise<GitConnection | null> {
  const { data, error } = await admin.from(CONNECTIONS).select("*").eq("task_id", taskId).maybeSingle();
  if (error) throw error;
  return (data as GitConnection | null) ?? null;
}

export async function saveGitConnection(
  admin: Admin,
  task: { id: string; user_id: string },
  repo: GithubRepository,
  branch: string,
): Promise<GitConnection> {
  const { data, error } = await admin
    .from(CONNECTIONS)
    .upsert(
      {
        task_id: task.id,
        user_id: task.user_id,
        repository_id: repo.id,
        repository: repo.fullName,
        branch,
        private: repo.private,
        connected_at: new Date().toISOString(),
        last_pushed_at: null,
      },
      { onConflict: "task_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as GitConnection;
}

export async function deleteGitConnection(admin: Admin, taskId: string): Promise<void> {
  const { error } = await admin.from(CONNECTIONS).delete().eq("task_id", taskId);
  if (error) throw error;
}

/** Notes a push, and the repository's name as it is now (it may have been renamed on GitHub). */
export async function notePush(admin: Admin, taskId: string): Promise<GitConnection | null> {
  const { data, error } = await admin
    .from(CONNECTIONS)
    .update({ last_pushed_at: new Date().toISOString() })
    .eq("task_id", taskId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as GitConnection | null) ?? null;
}

/** A branch name git and GitHub both accept, kept simple: no spaces, no "..", no odd endings. */
export function normalizeBranch(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const branch = value.trim();
  if (!branch || branch.length > 120) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch)) return null;
  if (branch.includes("..") || branch.includes("//") || branch.endsWith("/") || branch.endsWith(".") || branch.endsWith(".lock")) return null;
  return branch;
}

/**
 * A token that can push to one repository and do nothing else, good for an hour. It is the
 * app's, for the installation that covers the repository, cut down to that repository and to
 * its contents. Made only after the person's own access has just been checked.
 */
export async function mintPushToken(repo: GithubRepository): Promise<{ token: string; expiresAt: string } | null> {
  try {
    // Loaded when it is needed: the module refuses to load where the app is not set up.
    const { app } = await import("@/lib/github");
    const [owner, name] = repo.fullName.split("/") as [string, string];
    const installation = await app.octokit.request("GET /repos/{owner}/{repo}/installation", { owner, repo: name });
    const made = await app.octokit.request("POST /app/installations/{installation_id}/access_tokens", {
      installation_id: installation.data.id,
      repository_ids: [repo.id],
      permissions: { contents: "write" },
    });
    return { token: made.data.token, expiresAt: made.data.expires_at };
  } catch (error) {
    console.error(`[Tensor Cloud] Making a push token for ${repo.fullName} failed`, error);
    return null;
  }
}

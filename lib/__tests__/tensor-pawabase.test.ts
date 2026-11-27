import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { openForUser, sealForUser } from "@/lib/tensor-cloud";
import {
  appEnvironment,
  creationKey,
  createProject,
  listProjects,
  PawabaseError,
  pawabaseConnection,
  projectVariables,
  publishableKey,
  type PawabaseProject,
  type PawabaseTokens,
} from "@/lib/tensor-pawabase";

const USER = "11111111-1111-4111-8111-111111111111";
const config = { taskTokenSecret: "s".repeat(48) } as never;
const app = { clientId: "pbc_client", clientSecret: "pbs_secret" };
const PURPOSE = "tensor-pawabase-tokens";

type Call = { url: string; method: string; headers: Record<string, string>; body: string };

function pawabase(answers: Record<string, (call: Call) => Response>) {
  const calls: Call[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      body: typeof init?.body === "string" ? init.body : init?.body ? String(init.body) : "",
      headers: (init?.headers ?? {}) as Record<string, string>,
      method: init?.method ?? "GET",
      url: String(input),
    };
    calls.push(call);
    const key = Object.keys(answers).find((path) => `${call.method} ${call.url}`.includes(path));
    return key ? answers[key](call) : Response.json({ error: "not_found", message: "Not here." }, { status: 404 });
  });
  return { calls, fetcher: fetcher as unknown as typeof fetch };
}

/** The accounts table, in memory: one row, with the claim behaving as the real update does. */
function accounts(tokens: PawabaseTokens | null, refreshingUntil: string | null = null) {
  const row = tokens
    ? { refreshing_until: refreshingUntil, sealed: sealForUser(tokens, (config as { taskTokenSecret: string }).taskTokenSecret, USER, PURPOSE) }
    : null;
  const state = { row };
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.row && { ...state.row }, error: null }) }) }),
      update: (patch: Record<string, unknown>) => {
        const chain = {
          eq: () => chain,
          or: (filter: string) => {
            const at = filter.split("refreshing_until.lt.")[1];
            return {
              select: async () => {
                const free = state.row && (!state.row.refreshing_until || state.row.refreshing_until < at);
                if (!free || !state.row) return { data: [], error: null };
                Object.assign(state.row, patch);
                return { data: [{ ...state.row }], error: null };
              },
            };
          },
          then: (resolve: (value: { error: null }) => void) => {
            if (state.row) Object.assign(state.row, patch);
            resolve({ error: null });
          },
        };
        return chain;
      },
      upsert: async (value: { sealed: string; refreshing_until: string | null }) => {
        state.row = { refreshing_until: value.refreshing_until, sealed: value.sealed };
        return { error: null };
      },
    }),
  };
  const current = () => (state.row ? (openForUser(state.row.sealed, (config as { taskTokenSecret: string }).taskTokenSecret, USER, PURPOSE) as PawabaseTokens) : null);
  return { admin: admin as never, current, state };
}

const now = () => Math.floor(Date.now() / 1000);

describe("Pawabase for Tensor projects", () => {
  beforeEach(() => vi.useRealTimers());

  it("uses the token on record while it lasts", async () => {
    const { admin } = accounts({ accessToken: "at_1", expiresAt: now() + 3000, organization: "acme", refreshToken: "pbr_1" });
    const { calls, fetcher } = pawabase({});
    expect(await pawabaseConnection(admin, config, app, USER, fetcher)).toEqual({ organization: "acme", token: "at_1" });
    expect(calls).toHaveLength(0);
  });

  it("refreshes once, keeps the new pair before using it, and spends the old refresh token only once", async () => {
    const { admin, current, state } = accounts({ accessToken: "at_old", expiresAt: now() - 10, organization: "acme", refreshToken: "pbr_old" });
    const { calls, fetcher } = pawabase({
      "/oauth/token": () => Response.json({ access_token: "at_new", expires_in: 3600, organization: "acme", refresh_token: "pbr_new", token_type: "bearer" }),
    });
    const [first, second] = await Promise.all([
      pawabaseConnection(admin, config, app, USER, fetcher),
      pawabaseConnection(admin, config, app, USER, fetcher),
    ]);
    expect(first?.token).toBe("at_new");
    expect(second?.token).toBe("at_new");
    expect(calls.filter((call) => call.url.endsWith("/oauth/token"))).toHaveLength(1);
    expect(calls[0].body).toContain("refresh_token=pbr_old");
    expect(current()?.refreshToken).toBe("pbr_new");
    expect(state.row?.refreshing_until).toBeNull();
  });

  it("waits for another server's refresh instead of spending the same refresh token", async () => {
    const tracked = accounts(
      { accessToken: "at_old", expiresAt: now() - 10, organization: "acme", refreshToken: "pbr_old" },
      new Date(Date.now() + 20_000).toISOString(),
    );
    const { calls, fetcher } = pawabase({});
    // The other server finishes its refresh a moment later.
    setTimeout(() => {
      tracked.state.row = {
        refreshing_until: null,
        sealed: sealForUser(
          { accessToken: "at_theirs", expiresAt: now() + 3600, organization: "acme", refreshToken: "pbr_theirs" },
          (config as { taskTokenSecret: string }).taskTokenSecret,
          USER,
          PURPOSE,
        ),
      };
    }, 30);
    const got = await pawabaseConnection(tracked.admin, config, app, USER, fetcher, { everyMs: 10, tries: 20 });
    expect(got?.token).toBe("at_theirs");
    expect(calls).toHaveLength(0);
  });

  it("says to connect again when Pawabase turns the refresh down, and frees the claim", async () => {
    const { admin, state } = accounts({ accessToken: "at_old", expiresAt: now() - 10, organization: "acme", refreshToken: "pbr_old" });
    const { fetcher } = pawabase({ "/oauth/token": () => Response.json({ error: "invalid_grant" }, { status: 400 }) });
    expect(await pawabaseConnection(admin, config, app, USER, fetcher)).toBeNull();
    expect(state.row?.refreshing_until).toBeNull();
  });

  it("keeps the refresh token for another try when Pawabase cannot be reached", async () => {
    const { admin, current, state } = accounts({ accessToken: "at_old", expiresAt: now() - 10, organization: "acme", refreshToken: "pbr_old" });
    const { fetcher } = pawabase({ "/oauth/token": () => new Response("down", { status: 502 }) });
    await expect(pawabaseConnection(admin, config, app, USER, fetcher)).rejects.toThrow(PawabaseError);
    expect(current()?.refreshToken).toBe("pbr_old");
    expect(state.row?.refreshing_until).toBeNull();
  });

  it("is undefined for someone who never connected", async () => {
    const { admin } = accounts(null);
    expect(await pawabaseConnection(admin, config, app, USER, pawabase({}).fetcher)).toBeUndefined();
  });

  it("reads projects with their id, slug, state, failure and default environment", async () => {
    const { fetcher } = pawabase({
      "GET https://dashboard.pawabase.com/v1/projects": () =>
        Response.json([
          {
            default_environment: "acme-mellow-dingo-swrz-development",
            endpoints: { api: "https://acme.pawabase.app" },
            failure: null,
            id: "prj_1",
            name: "Bakery",
            ref: "acme-mellow-dingo-swrz",
            state: "running",
          },
          { failure: { reason: "Out of capacity in this region.", retryable: true }, id: "prj_2", name: "Shop", ref: "shop-x", state: "failed" },
        ]),
    });
    const [bakery, shop] = await listProjects("at", fetcher);
    expect(bakery).toMatchObject({ apiUrl: "https://acme.pawabase.app", id: "prj_1", ref: "acme-mellow-dingo-swrz", state: "running" });
    expect(appEnvironment(bakery)).toBe("acme-mellow-dingo-swrz-development");
    expect(shop).toMatchObject({ failureReason: "Out of capacity in this region.", state: "failed" });
  });

  it("makes a project with a key that stays the same for a retried request", async () => {
    const { calls, fetcher } = pawabase({
      "POST https://dashboard.pawabase.com/v1/projects": () => Response.json({ id: "prj_1", name: "Bakery", ref: "bakery-x", state: "creating" }, { status: 201 }),
    });
    await createProject("at", { name: "Bakery", taskId: "task-1" }, fetcher);
    await createProject("at", { name: "Bakery", taskId: "task-1" }, fetcher);
    const keys = calls.map((call) => call.headers["idempotency-key"]);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(creationKey("task-1", "Other")).not.toBe(keys[0]);
    expect(JSON.parse(calls[0].body)).toEqual({ description: "Made by Tensor", name: "Bakery" });
  });

  it("uses a publishable key Pawabase can show, preferring one for every environment, and makes one when none can be shown", async () => {
    const shown = pawabase({
      "GET https://dashboard.pawabase.com/v1/projects/p/api-keys": () =>
        Response.json({
          data: [
            { active: true, environments: ["development"], key: "pb_pk_dev", role: "publishable" },
            { active: true, environments: "all", key: "pb_pk_all", role: "publishable" },
            { active: true, environments: "all", key: null, role: "secret" },
          ],
        }),
    });
    expect(await publishableKey("at", "p", shown.fetcher)).toBe("pb_pk_all");

    const hidden = pawabase({
      "GET https://dashboard.pawabase.com/v1/projects/p/api-keys": () =>
        Response.json({ data: [{ active: true, environments: "all", key: null, role: "publishable" }] }),
      "POST https://dashboard.pawabase.com/v1/projects/p/api-keys": () =>
        Response.json({ environments: "all", key: "pb_pk_new", role: "publishable" }, { status: 201 }),
    });
    expect(await publishableKey("at", "p", hidden.fetcher)).toBe("pb_pk_new");
    const made = hidden.calls.find((call) => call.method === "POST");
    expect(JSON.parse(made?.body ?? "{}")).toEqual({ environments: "all", name: "Tensor", role: "publishable" });
  });

  it("writes the address, project id, environment and publishable key, for the server and the browser", () => {
    const project: PawabaseProject = {
      apiUrl: "https://acme.pawabase.app",
      defaultEnvironment: "acme-x-development",
      environments: [{ isDefault: true, key: "acme-x-development", slug: "development", status: "ready" }],
      failureReason: null,
      id: "prj_1",
      name: "Bakery",
      ref: "acme-x",
      state: "running",
      studioUrl: null,
    };
    const variables = projectVariables(project, { publishable: "pb_pk_1" });
    expect(Object.fromEntries(variables.map((one) => [one.name, one.value]))).toEqual({
      NEXT_PUBLIC_PAWABASE_ENV: "development",
      NEXT_PUBLIC_PAWABASE_PROJECT: "prj_1",
      NEXT_PUBLIC_PAWABASE_PUBLISHABLE_KEY: "pb_pk_1",
      NEXT_PUBLIC_PAWABASE_URL: "https://acme.pawabase.app",
      PAWABASE_ENV: "development",
      PAWABASE_PROJECT: "prj_1",
      PAWABASE_PUBLISHABLE_KEY: "pb_pk_1",
      PAWABASE_URL: "https://acme.pawabase.app",
    });
    // The secret key only when asked for, and never with a browser copy.
    const withSecret = projectVariables(project, { publishable: "pb_pk_1", secret: "pb_sk_1" }).map((one) => one.name);
    expect(withSecret).toContain("PAWABASE_SECRET_KEY");
    expect(withSecret).not.toContain("NEXT_PUBLIC_PAWABASE_SECRET_KEY");
  });

  it("says plainly what Pawabase refused", async () => {
    const { fetcher } = pawabase({
      "POST https://dashboard.pawabase.com/v1/projects": () =>
        Response.json({ details: { limit: 2, used: 2 }, error: "plan_limit", message: "Your plan allows 2 projects." }, { status: 402 }),
    });
    await expect(createProject("at", { name: "x", taskId: "t" }, fetcher)).rejects.toMatchObject({
      code: "plan_limit",
      message: "Your plan allows 2 projects.",
      status: 402,
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin-users", () => ({
  adminUsers: {
    getUserById: vi.fn(async (id: string) => ({
      data: { user: { email: "bola@example.com", id, user_metadata: { full_name: "Bola Banjo" } } },
      error: null,
    })),
  },
}));
vi.mock("@/lib/tensor-profile", () => ({
  profileJson: (_row: unknown, user: { email: string }) => ({
    avatarUrl: null,
    email: user.email,
    firstName: "Bola",
    lastName: "Banjo",
    username: null,
  }),
  readProfileRow: vi.fn(async () => null),
}));

const config = { apiOrigin: "https://quality.test", clientId: "qlo_client", clientSecret: "qlo_secret_x" };
const USER = "11111111-1111-4111-8111-111111111111";
const TASK = "22222222-2222-4222-8222-222222222222";

type Call = { url: string; method: string; headers: Record<string, string>; body: string | undefined };

/** A stand-in for Quality: answers per path, and keeps every call. */
function quality(answers: Record<string, (call: Call) => Response>) {
  const calls: Call[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const call: Call = {
      body: typeof init?.body === "string" ? init.body : init?.body ? String(init.body) : undefined,
      headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)),
      method: init?.method ?? "GET",
      url,
    };
    calls.push(call);
    const key = Object.keys(answers).find((path) => url.includes(path));
    return key ? answers[key](call) : new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  });
  return { calls, fetcher: fetcher as unknown as typeof fetch };
}

const tokenAnswer = (value = "qlo_pt_one") => () =>
  Response.json({ access_token: value, expires_in: 3600, scope: "partner", token_type: "Bearer" });

describe("Tensor x Quality", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("registers a project as an app with one token, and returns its site id", async () => {
    const { upsertQualityApp } = await import("@/lib/tensor-quality");
    const { calls, fetcher } = quality({
      "/oauth/apps/token": tokenAnswer(),
      [`/projects/${TASK}`]: () => Response.json({ project_id: "p", site_id: "qs_live_abc" }),
    });
    const input = { mode: "members" as const, name: "Bakery", productionUrl: "https://bakery.cencori.app", taskId: TASK, userId: USER };
    expect(await upsertQualityApp(config, input, fetcher)).toBe("qs_live_abc");
    expect(await upsertQualityApp(config, input, fetcher)).toBe("qs_live_abc");

    const tokens = calls.filter((call) => call.url.endsWith("/oauth/apps/token"));
    expect(tokens).toHaveLength(1);
    expect(tokens[0].headers.authorization).toBe(`Basic ${Buffer.from("qlo_client:qlo_secret_x").toString("base64")}`);
    const put = calls.find((call) => call.method === "PUT");
    expect(put?.url).toBe(`https://quality.test/api/v1/partner/teams/${USER}/projects/${TASK}`);
    expect(put?.headers.authorization).toBe("Bearer qlo_pt_one");
    expect(JSON.parse(put?.body ?? "{}")).toEqual({
      name: "Bakery",
      production_mode: "members",
      production_url: "https://bakery.cencori.app",
    });
  });

  it("asks for a new token once when Quality turns the kept one down", async () => {
    const { qualityThreads } = await import("@/lib/tensor-quality");
    let issued = 0;
    let first = true;
    const { fetcher } = quality({
      "/oauth/apps/token": () => Response.json({ access_token: `qlo_pt_${++issued}`, expires_in: 3600 }),
      "/threads": () => {
        if (first) {
          first = false;
          return new Response(JSON.stringify({ error: "expired" }), { status: 401 });
        }
        return Response.json({ data: [], next_cursor: null });
      },
    });
    expect(await qualityThreads(config, USER, TASK, {}, fetcher)).toEqual({ data: [], next_cursor: null });
    expect(issued).toBe(2);
  });

  it("says plainly when Quality has not switched partner access on", async () => {
    const { QualityError, removeQualityApp } = await import("@/lib/tensor-quality");
    const { fetcher } = quality({
      "/oauth/apps/token": () => new Response(JSON.stringify({ error: "unauthorized_client" }), { status: 400 }),
    });
    await expect(removeQualityApp(config, USER, TASK, fetcher)).rejects.toThrow(QualityError);
    await expect(removeQualityApp(config, USER, TASK, fetcher)).rejects.toThrow(/unauthorized_client/);
  });

  it("brings the owner's team up to date with them as its owner", async () => {
    const { syncQualityTeam } = await import("@/lib/tensor-quality");
    const { calls, fetcher } = quality({
      "/oauth/apps/token": tokenAnswer(),
      [`/teams/${USER}/members`]: () => Response.json({ members: [] }),
      [`/teams/${USER}`]: () => Response.json({ id: USER, status: "active" }),
    });
    await syncQualityTeam({} as never, config, USER, fetcher);
    const team = calls.find((call) => call.url.endsWith(`/teams/${USER}`));
    expect(JSON.parse(team?.body ?? "{}")).toEqual({
      name: "Bola Banjo",
      owner: { email: "bola@example.com", first_name: "Bola", id: USER, last_name: "Banjo" },
    });
    const members = calls.find((call) => call.url.endsWith("/members"));
    expect(JSON.parse(members?.body ?? "{}").members).toEqual([
      { email: "bola@example.com", first_name: "Bola", id: USER, last_name: "Banjo", role: "owner" },
    ]);
  });

  it("tells the gateway the site id with a ticket for the project's Quality setting", async () => {
    const { setGatewayQuality } = await import("@/lib/tensor-quality");
    const { calls, fetcher } = quality({ "/v1/sites/quality": () => Response.json({ ok: true, on: true }) });
    await setGatewayQuality(
      { gatewayUrl: "wss://gateway.test", ticketSecret: "s3cret" } as never,
      { id: TASK, user_id: USER },
      "bakery",
      "qs_live_abc",
      fetcher,
    );
    const call = calls[0];
    expect(call.method).toBe("PUT");
    expect(JSON.parse(call.body ?? "{}")).toEqual({ siteId: "qs_live_abc" });
    const ticket = new URL(call.url).searchParams.get("ticket") ?? "";
    const claims = JSON.parse(Buffer.from(ticket.split(".")[1], "base64url").toString());
    expect(claims).toMatchObject({ action: "quality", name: "bakery", sub: USER, task: TASK });
  });
  it("changes only the app when Quality is already on for the project", async () => {
    const { enableQuality } = await import("@/lib/tensor-quality");
    const { calls, fetcher } = quality({
      "/oauth/apps/token": tokenAnswer(),
      [`/projects/${TASK}`]: () => Response.json({ site_id: "qs_live_abc" }),
    });
    const upsert = vi.fn(async () => ({ error: null }));
    const admin = { from: () => ({ upsert }) } as never;
    const existing = { mode: "members" as const, site_id: "qs_live_abc", task_id: TASK, user_id: USER };
    const link = await enableQuality(
      admin,
      { gatewayUrl: "wss://gateway.test", ticketSecret: "s3cret" } as never,
      config,
      { existing, mode: "anyone", siteName: "bakery", sitesDomain: "cencori.app", task: { id: TASK, user_id: USER }, title: "Bakery" },
      fetcher,
    );
    expect(link.mode).toBe("anyone");
    const sent = calls.filter((call) => !call.url.endsWith("/oauth/apps/token")).map((call) => new URL(call.url).pathname);
    expect(sent).toEqual([`/api/v1/partner/teams/${USER}/projects/${TASK}`]);
  });
  it("opens the app signed in with a one-time link from Quality, on a page of that app only", async () => {
    const { qualitySignInUrl } = await import("@/lib/tensor-quality");
    const { calls, fetcher } = quality({
      "/oauth/apps/token": tokenAnswer(),
      "/embed/launch": (call) =>
        Response.json({
          expires_at: "2026-11-26T10:05:00Z",
          url: `${JSON.parse(call.body ?? "{}").url}#quality-signin=qls_one`,
        }),
    });
    const link = { mode: "members" as const, site_id: "qs_live_abc", task_id: TASK, user_id: USER };
    const input = { link, siteName: "bakery", sitesDomain: "cencori.app", title: "Bakery" };
    expect(await qualitySignInUrl({} as never, config, { ...input, path: "/menu?x=1#top" }, fetcher)).toBe(
      "https://bakery.cencori.app/menu?x=1#quality-signin=qls_one",
    );
    expect(await qualitySignInUrl({} as never, config, { ...input, path: "//evil.test/x" }, fetcher)).toBe(
      "https://bakery.cencori.app/#quality-signin=qls_one",
    );
    const launch = calls.find((call) => call.url.includes("/embed/launch"));
    expect(launch?.method).toBe("POST");
    expect(new URL(launch?.url ?? "").pathname).toBe(
      `/api/v1/partner/teams/${USER}/projects/${TASK}/members/${USER}/embed/launch`,
    );
  });

  it("registers the owner and app again when Quality does not know them, then asks once more", async () => {
    const { qualitySignInUrl } = await import("@/lib/tensor-quality");
    let launches = 0;
    const { calls, fetcher } = quality({
      "/oauth/apps/token": tokenAnswer(),
      "/embed/launch": () =>
        ++launches === 1
          ? Response.json({ error: "Member not found." }, { status: 404 })
          : Response.json({ url: "https://bakery.cencori.app/#quality-signin=qls_two" }),
      [`/teams/${USER}/members`]: () => Response.json({ members: [] }),
      [`/projects/${TASK}`]: () => Response.json({ site_id: "qs_live_abc" }),
      [`/teams/${USER}`]: () => Response.json({ id: USER }),
    });
    const link = { mode: "members" as const, site_id: "qs_live_abc", task_id: TASK, user_id: USER };
    const url = await qualitySignInUrl({} as never, config, { link, siteName: "bakery", sitesDomain: "cencori.app", title: "Bakery" }, fetcher);
    expect(url).toBe("https://bakery.cencori.app/#quality-signin=qls_two");
    const sent = calls.filter((call) => !call.url.endsWith("/oauth/apps/token")).map((call) => `${call.method} ${new URL(call.url).pathname}`);
    expect(sent).toEqual([
      `POST /api/v1/partner/teams/${USER}/projects/${TASK}/members/${USER}/embed/launch`,
      `PUT /api/v1/partner/teams/${USER}`,
      `PUT /api/v1/partner/teams/${USER}/members`,
      `PUT /api/v1/partner/teams/${USER}/projects/${TASK}`,
      `POST /api/v1/partner/teams/${USER}/projects/${TASK}/members/${USER}/embed/launch`,
    ]);
  });

  it("refuses a link Quality made for another site", async () => {
    const { qualitySignInUrl, QualityError } = await import("@/lib/tensor-quality");
    const { fetcher } = quality({
      "/oauth/apps/token": tokenAnswer(),
      "/embed/launch": () => Response.json({ url: "https://elsewhere.test/#quality-signin=qls_x" }),
    });
    const link = { mode: "members" as const, site_id: "qs_live_abc", task_id: TASK, user_id: USER };
    await expect(
      qualitySignInUrl({} as never, config, { link, siteName: "bakery", sitesDomain: "cencori.app", title: "Bakery" }, fetcher),
    ).rejects.toThrow(QualityError);
  });
});

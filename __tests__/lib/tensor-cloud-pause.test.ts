import { beforeEach, describe, expect, it, vi } from "vitest";

// The plan each account is on, set by each test.
const plans = new Map<string, string>();
vi.mock("@/lib/supabaseAdmin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/tensor-billing", () => ({
  effectiveTensorPlan: vi.fn((account: { user: string }) => plans.get(account.user) ?? "free"),
  getOrCreateTensorBillingAccount: vi.fn(async (_admin: unknown, userId: string) => ({ user: userId })),
}));
const sent: Array<{ to: string[]; subject: string; html: string }> = [];
vi.mock("@/lib/email/sendbyte", () => ({
  escapeHtml: (value: string) => value,
  sendEmail: vi.fn(async (message: { to: string[]; subject: string; html: string }) => {
    sent.push(message);
    return true;
  }),
}));
vi.mock("@/lib/auth/admin-users", () => ({
  adminUsers: { getUserById: vi.fn(async (id: string) => ({ data: { user: { email: `${id}@example.com`, user_metadata: { full_name: "Bola Banjo" } } } })) },
}));
vi.mock("@/lib/user-unsubscribe", () => ({
  generateUserUnsubscribeToken: () => "token",
  buildUserUnsubscribeUrl: (base: string, id: string, token: string) => `${base}/unsubscribe?u=${id}&t=${token}`,
}));
const destroyed: string[] = [];
vi.mock("@/lib/tensor-cloud", async (original) => ({
  ...(await original<typeof import("@/lib/tensor-cloud")>()),
  sitesFly: () => ({
    destroy: async (id: string) => (destroyed.push(id), { ok: true, value: null }),
    destroyVolume: async (id: string) => (destroyed.push(id), { ok: true, value: null }),
  }),
}));

import { readTensorCloudConfig, type TensorCloudConfig } from "@/lib/tensor-cloud";
import { applyPlanToApps, PAUSE_DELETE_DAYS, PAUSE_WARN_DAYS, pauseDeletesAt } from "@/lib/tensor-cloud-tasks";

const config = readTensorCloudConfig({
  TENSOR_CLOUD_FLY_API_TOKEN: "fly-token",
  TENSOR_CLOUD_SANDBOX_IMAGE: "registry.fly.io/tensor-sandbox:test",
  TENSOR_CLOUD_GATEWAY_URL: "wss://gateway.example",
  TENSOR_CLOUD_TICKET_SECRET: "ticket-secret-ticket-secret-ticket-secret",
  TENSOR_CLOUD_SANDBOX_TOKEN_SECRET: "sandbox-secret-sandbox-secret-sandbox-secret",
  TENSOR_CLOUD_TASK_TOKEN_SECRET: "task-secret-task-secret-task-secret-task",
}) as TensorCloudConfig;

type Row = Record<string, unknown>;

/** A database of one table, enough of Supabase's query builder for these functions. */
function database(rows: Row[]) {
  const query = (table: Row[]) => {
    let found = [...table];
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => ((found = found.filter((row) => row[column] === value)), builder),
      not: (column: string) => ((found = found.filter((row) => row[column] != null)), builder),
      order: (column: string) => ((found = [...found].sort((a, b) => String(a[column]).localeCompare(String(b[column])))), builder),
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) => resolve({ data: found, error: null }),
    };
    return builder;
  };
  const admin = {
    from: () => ({
      select: () => query(rows).select(),
      update: (patch: Row) => ({
        eq: async (column: string, value: unknown) => {
          for (const row of rows) if (row[column] === value) Object.assign(row, patch);
          return { error: null };
        },
      }),
      delete: () => ({
        eq: async (column: string, value: unknown) => {
          for (let at = rows.length - 1; at >= 0; at--) if (rows[at]![column] === value) rows.splice(at, 1);
          return { error: null };
        },
      }),
    }),
  };
  return admin as never;
}

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-12-01T06:00:00Z");
const daysAgo = (days: number) => new Date(now - days * DAY).toISOString();

/** The gateway: an app it is told to pause says it is paused; one given allowances, that it is not. */
const asked: string[] = [];
beforeEach(() => {
  plans.clear();
  sent.length = 0;
  destroyed.length = 0;
  asked.length = 0;
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    asked.push(`${init?.method ?? "GET"} ${new URL(url).pathname}`);
    if (new URL(url).pathname === "/v1/sites/plan") {
      const ticket = new URL(url).searchParams.get("ticket")!;
      const claims = JSON.parse(Buffer.from(ticket.split(".")[1]!, "base64url").toString());
      return new Response(JSON.stringify({ usage: { month: "2026-12", bytes: 0, awakeSeconds: 0, limits: claims.limits ?? {}, paused: Boolean(claims.paused) } }));
    }
    if (new URL(url).pathname === "/v1/sites") return new Response(JSON.stringify({ domain: "cencori.app" }));
    return new Response("{}");
  });
});

const app = (over: Row = {}): Row => ({
  task_id: "t-app",
  user_id: "u1",
  name: "shop",
  kind: "app",
  machine_id: "148e21dc03d789",
  volume_id: "vol_1",
  published_at: daysAgo(60),
  created_at: daysAgo(60),
  paused_at: null,
  pause_warned_at: null,
  ...over,
});

describe("a published app whose plan no longer includes it", () => {
  it("is paused, and the grace period begins", async () => {
    const rows = [app()];
    const done = await applyPlanToApps(database(rows), config, "u1", now);
    expect(done).toMatchObject({ paused: 1, warned: 0, deleted: 0 });
    expect(rows[0]!.paused_at).toBe(new Date(now).toISOString());
    expect(pauseDeletesAt(rows[0]!.paused_at as string)).toBe(new Date(now + PAUSE_DELETE_DAYS * DAY).toISOString());
  });

  it("is warned once, a week before it goes", async () => {
    const rows = [app({ paused_at: daysAgo(PAUSE_WARN_DAYS - 1) })];
    await applyPlanToApps(database(rows), config, "u1", now);
    expect(sent).toHaveLength(0);

    rows[0]!.paused_at = daysAgo(PAUSE_WARN_DAYS);
    await applyPlanToApps(database(rows), config, "u1", now);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toEqual(["u1@example.com"]);
    expect(sent[0]!.subject).toMatch(/^shop\.cencori\.app will be deleted on /);
    expect(sent[0]!.html).toContain("Hi Bola,");
    expect(sent[0]!.html).toContain("Keep my app");
    expect(rows[0]!.pause_warned_at).toBeTruthy();

    await applyPlanToApps(database(rows), config, "u1", now);
    expect(sent).toHaveLength(1);
  });

  it("is deleted after 30 days, machine, disk, name and all", async () => {
    const rows = [app({ paused_at: daysAgo(PAUSE_DELETE_DAYS), pause_warned_at: daysAgo(7) })];
    const done = await applyPlanToApps(database(rows), config, "u1", now);
    expect(done.deleted).toBe(1);
    expect(destroyed).toEqual(["148e21dc03d789", "vol_1"]);
    expect(asked).toContain("DELETE /v1/sites");
    expect(rows).toHaveLength(0);
  });

  it("is served again, and the clock stops, when the plan includes it again", async () => {
    plans.set("u1", "pro");
    const rows = [app({ paused_at: daysAgo(29), pause_warned_at: daysAgo(6) })];
    const done = await applyPlanToApps(database(rows), config, "u1", now);
    expect(done).toMatchObject({ applied: 1, paused: 0, deleted: 0 });
    expect(rows[0]).toMatchObject({ paused_at: null, pause_warned_at: null });
    expect(destroyed).toHaveLength(0);
  });

  it("keeps the ones published first when the plan has room for fewer", async () => {
    plans.set("u1", "pro"); // one app
    const rows = [app({ task_id: "older", created_at: daysAgo(90) }), app({ task_id: "newer", name: "shop-2", created_at: daysAgo(10) })];
    await applyPlanToApps(database(rows), config, "u1", now);
    expect(rows.find((row) => row.task_id === "older")!.paused_at).toBeNull();
    expect(rows.find((row) => row.task_id === "newer")!.paused_at).toBe(new Date(now).toISOString());
  });

  it("leaves a site of files paused, but never deletes it: it costs nothing to keep", async () => {
    const rows = [app({ task_id: "files", kind: "static", machine_id: null, volume_id: null, paused_at: daysAgo(400) })];
    const done = await applyPlanToApps(database(rows), config, "u1", now);
    expect(done).toMatchObject({ paused: 1, deleted: 0 });
    expect(rows).toHaveLength(1);
    expect(sent).toHaveLength(0);
  });
});

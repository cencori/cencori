// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const row = vi.hoisted(() => ({
  current: { enabled: false, message: null as string | null, retry_after_seconds: 600 } as Record<string, unknown> | null,
  fail: false,
  reads: 0,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createAdminClient: () => {
    const query = {
      select: () => query,
      eq: () => query,
      abortSignal: () => query,
      maybeSingle: async () => {
        row.reads += 1;
        return row.fail ? { data: null, error: new Error("down") } : { data: row.current, error: null };
      },
    };
    return { from: () => query };
  },
}));

async function load() {
  vi.resetModules();
  return import("./maintenance");
}

function req(url: string, init?: { headers?: Record<string, string> }) {
  return new NextRequest(new URL(url), { headers: init?.headers });
}

describe("maintenanceResponse", () => {
  beforeEach(() => {
    row.current = { enabled: false, message: null, retry_after_seconds: 600 };
    row.fail = false;
    row.reads = 0;
    vi.stubEnv("MAINTENANCE_MODE", "");
    vi.stubEnv("MAINTENANCE_BYPASS_TOKEN", "s3cret-token");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("lets everything through while the flag is off", async () => {
    const { maintenanceResponse } = await load();
    expect(await maintenanceResponse(req("https://cencori.com/dashboard"))).toBeNull();
  });

  it("answers the API with a JSON 503 and Retry-After", async () => {
    row.current = { enabled: true, message: null, retry_after_seconds: 900 };
    const { maintenanceResponse } = await load();
    const res = await maintenanceResponse(req("https://cencori.com/v1/chat/completions"));
    expect(res?.status).toBe(503);
    expect(res?.headers.get("retry-after")).toBe("900");
    expect((await res!.json()).error.code).toBe("maintenance");
  });

  it("answers pages with an HTML 503 carrying the message, escaped", async () => {
    row.current = { enabled: true, message: "Back at <b>10:00</b>", retry_after_seconds: 600 };
    const { maintenanceResponse } = await load();
    const res = await maintenanceResponse(req("https://cencori.com/login"));
    expect(res?.status).toBe(503);
    expect(res?.headers.get("content-type")).toContain("text/html");
    const html = await res!.text();
    expect(html).toContain("Back at &#60;b&#62;10:00&#60;/b&#62;");
  });

  it("keeps the health check up", async () => {
    row.current = { enabled: true, message: null, retry_after_seconds: 600 };
    const { maintenanceResponse } = await load();
    expect(await maintenanceResponse(req("https://cencori.com/api/v1/health"))).toBeNull();
  });

  it("lets the bypass cookie through, not a wrong one, and ignores the old header and query", async () => {
    row.current = { enabled: true, message: null, retry_after_seconds: 600 };
    const { maintenanceResponse, MAINTENANCE_BYPASS_COOKIE } = await load();
    expect(
      await maintenanceResponse(
        req("https://cencori.com/api/projects/x", { headers: { cookie: `${MAINTENANCE_BYPASS_COOKIE}=s3cret-token` } }),
      ),
    ).toBeNull();
    const wrong = await maintenanceResponse(
      req("https://cencori.com/dashboard", { headers: { cookie: `${MAINTENANCE_BYPASS_COOKIE}=nope` } }),
    );
    expect(wrong?.status).toBe(503);
    const header = await maintenanceResponse(
      req("https://cencori.com/api/projects/x", { headers: { "x-cencori-maintenance-bypass": "s3cret-token" } }),
    );
    expect(header?.status).toBe(503);
    expect((await maintenanceResponse(req("https://cencori.com/?maintenance_bypass=s3cret-token")))?.status).toBe(503);
  });

  it("sets the bypass cookie from a POSTed token, even before the window", async () => {
    const { maintenanceResponse, MAINTENANCE_BYPASS_COOKIE, MAINTENANCE_BYPASS_PATH } = await load();
    const post = (token: string) =>
      new NextRequest(new URL(`https://cencori.com${MAINTENANCE_BYPASS_PATH}`), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `token=${token}`,
      });
    const ok = await maintenanceResponse(post("s3cret-token"));
    expect(ok?.status).toBe(204);
    expect(ok?.cookies.get(MAINTENANCE_BYPASS_COOKIE)?.value).toBe("s3cret-token");

    const bad = await maintenanceResponse(post("nope"));
    expect(bad?.status).toBe(403);
    expect(bad?.cookies.get(MAINTENANCE_BYPASS_COOKIE)).toBeUndefined();
    expect((await maintenanceResponse(req(`https://cencori.com${MAINTENANCE_BYPASS_PATH}`)))?.status).toBe(405);
  });

  it("serves a page that turns a #maintenance_bypass link into that POST", async () => {
    row.current = { enabled: true, message: null, retry_after_seconds: 600 };
    const { maintenanceResponse, MAINTENANCE_BYPASS_PATH } = await load();
    const html = await (await maintenanceResponse(req("https://cencori.com/dashboard")))!.text();
    expect(html).toContain("maintenance_bypass=");
    expect(html).toContain(`fetch("${MAINTENANCE_BYPASS_PATH}"`);
  });

  it("honours MAINTENANCE_MODE without reading the database", async () => {
    vi.stubEnv("MAINTENANCE_MODE", "on");
    const { maintenanceResponse } = await load();
    expect((await maintenanceResponse(req("https://cencori.com/")))?.status).toBe(503);
    expect(row.reads).toBe(0);
  });

  it("caches the row and keeps the last known state when a read fails", async () => {
    vi.useFakeTimers();
    try {
      row.current = { enabled: true, message: null, retry_after_seconds: 600 };
      const { getMaintenanceState } = await load();
      expect((await getMaintenanceState()).enabled).toBe(true);
      await getMaintenanceState();
      expect(row.reads).toBe(1);

      row.fail = true;
      vi.advanceTimersByTime(11_000);
      expect((await getMaintenanceState()).enabled).toBe(true);
      expect(row.reads).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails open when the first read fails", async () => {
    row.fail = true;
    const { getMaintenanceState } = await load();
    expect((await getMaintenanceState()).enabled).toBe(false);
  });
});

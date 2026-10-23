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

  it("lets the bypass token through by header and by cookie, not a wrong one", async () => {
    row.current = { enabled: true, message: null, retry_after_seconds: 600 };
    const { maintenanceResponse, MAINTENANCE_BYPASS_HEADER, MAINTENANCE_BYPASS_COOKIE } = await load();
    expect(
      await maintenanceResponse(
        req("https://cencori.com/api/projects/x", { headers: { [MAINTENANCE_BYPASS_HEADER]: "s3cret-token" } }),
      ),
    ).toBeNull();
    expect(
      await maintenanceResponse(
        req("https://cencori.com/dashboard", { headers: { cookie: `${MAINTENANCE_BYPASS_COOKIE}=s3cret-token` } }),
      ),
    ).toBeNull();
    const wrong = await maintenanceResponse(
      req("https://cencori.com/dashboard", { headers: { [MAINTENANCE_BYPASS_HEADER]: "nope" } }),
    );
    expect(wrong?.status).toBe(503);
  });

  it("sets the bypass cookie from the query parameter and strips it", async () => {
    row.current = { enabled: true, message: null, retry_after_seconds: 600 };
    const { maintenanceResponse, MAINTENANCE_BYPASS_COOKIE } = await load();
    const res = await maintenanceResponse(req("https://cencori.com/dashboard?a=1&maintenance_bypass=s3cret-token"));
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toBe("https://cencori.com/dashboard?a=1");
    expect(res?.cookies.get(MAINTENANCE_BYPASS_COOKIE)?.value).toBe("s3cret-token");

    const bad = await maintenanceResponse(req("https://cencori.com/dashboard?maintenance_bypass=nope"));
    expect(bad?.cookies.get(MAINTENANCE_BYPASS_COOKIE)).toBeUndefined();
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

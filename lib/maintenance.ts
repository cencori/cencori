import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Maintenance mode for the RFC-0001 cutover window. The switch is one row in
// public.platform_maintenance (see its migration), read by proxy.ts on every
// request through a short cache. MAINTENANCE_MODE=on|off overrides the row
// without touching the database, for when the database is the problem.

export type MaintenanceState = {
  enabled: boolean;
  message: string | null;
  retryAfterSeconds: number;
};

const OFF: MaintenanceState = { enabled: false, message: null, retryAfterSeconds: 600 };
const CACHE_MS = 10_000;
const READ_TIMEOUT_MS = 1_500;

const DEFAULT_MESSAGE =
  "Cencori is down for scheduled maintenance while we move to our new infrastructure. We'll be back shortly.";

export const MAINTENANCE_BYPASS_COOKIE = "cencori-maintenance-bypass";
export const MAINTENANCE_BYPASS_HEADER = "x-cencori-maintenance-bypass";
const BYPASS_PARAM = "maintenance_bypass";

let cached: { state: MaintenanceState; at: number } | null = null;
let inflight: Promise<MaintenanceState> | null = null;

async function readState(): Promise<MaintenanceState> {
  const { createAdminClient } = await import("@/lib/supabaseAdmin");
  const { data, error } = await createAdminClient()
    .from("platform_maintenance")
    .select("enabled, message, retry_after_seconds")
    .eq("id", true)
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS))
    .maybeSingle();
  if (error) throw error;
  if (!data) return OFF;
  return {
    enabled: data.enabled === true,
    message: typeof data.message === "string" && data.message.trim() ? data.message : null,
    retryAfterSeconds: Number(data.retry_after_seconds) > 0 ? Number(data.retry_after_seconds) : 600,
  };
}

export async function getMaintenanceState(): Promise<MaintenanceState> {
  const override = process.env.MAINTENANCE_MODE?.toLowerCase();
  if (override === "on") return { ...OFF, enabled: true };
  if (override === "off") return OFF;

  if (cached && Date.now() - cached.at < CACHE_MS) return cached.state;
  inflight ??= readState()
    .then((state) => {
      cached = { state, at: Date.now() };
      return state;
    })
    .catch((error) => {
      // Fail open, keeping the last known state: an unreadable flag must not
      // take the site down, nor end a window that is already on.
      console.error("[Maintenance] Could not read platform_maintenance", error);
      const state = cached?.state ?? OFF;
      cached = { state, at: Date.now() };
      return state;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function tokenMatches(candidate: string | null | undefined): boolean {
  const token = process.env.MAINTENANCE_BYPASS_TOKEN;
  if (!token || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Paths that answer even during maintenance: Brimble's deploy health check
// (a 503 there would fail the deploy) and build assets.
function isExemptPath(pathname: string): boolean {
  return (
    pathname === "/api/v1/health" ||
    pathname === "/v1/health" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname.startsWith("/v1/") || pathname === "/v1";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function maintenancePage(message: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Scheduled maintenance · Cencori</title>
<style>
  :root { color-scheme: light dark; --bg: #fff; --fg: #0a0a0a; --muted: #6b6b6b; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0a0a0a; --fg: #fafafa; --muted: #a1a1a1; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg);
    font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 32rem; padding: 0 16px; }
  h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 .5rem; }
  p { margin: 0 0 1rem; color: var(--muted); }
  a { color: inherit; }
</style>
</head>
<body>
<main>
  <h1>Scheduled maintenance</h1>
  <p>${escapeHtml(message)}</p>
  <p>Follow progress on <a href="https://status.cencori.com">status.cencori.com</a>.</p>
</main>
</body>
</html>`;
}

/**
 * The response for this request while maintenance is on, or null to carry on.
 * A `?maintenance_bypass=<token>` visit sets a bypass cookie and reloads
 * without the parameter; API clients send the token in a header instead.
 */
export async function maintenanceResponse(request: NextRequest): Promise<NextResponse | null> {
  const { pathname, searchParams } = request.nextUrl;
  if (isExemptPath(pathname)) return null;

  const state = await getMaintenanceState();
  if (!state.enabled) return null;

  const offered = searchParams.get(BYPASS_PARAM);
  if (offered !== null) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete(BYPASS_PARAM);
    const response = NextResponse.redirect(clean);
    if (tokenMatches(offered)) {
      response.cookies.set(MAINTENANCE_BYPASS_COOKIE, offered, {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 12 * 60 * 60,
      });
    }
    return response;
  }
  if (
    tokenMatches(request.headers.get(MAINTENANCE_BYPASS_HEADER)) ||
    tokenMatches(request.cookies.get(MAINTENANCE_BYPASS_COOKIE)?.value)
  ) {
    return null;
  }

  const message = state.message ?? DEFAULT_MESSAGE;
  const headers = {
    "Retry-After": String(state.retryAfterSeconds),
    "Cache-Control": "no-store",
  };
  if (isApiPath(pathname)) {
    return NextResponse.json(
      { error: { message, type: "service_unavailable", code: "maintenance" } },
      { status: 503, headers },
    );
  }
  return new NextResponse(maintenancePage(message), {
    status: 503,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}

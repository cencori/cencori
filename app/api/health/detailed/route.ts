import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { generateHealthSummary } from "@/lib/health-summary";

//  Types
type ServiceStatus = "healthy" | "degraded" | "down";

interface ServiceHealth {
  status: ServiceStatus;
  latencyMs: number;
  error?: string;
}

interface HealthResponse {
  status: ServiceStatus;
  timestamp: string;
  services: {
    database: ServiceHealth;
    aiGateway: ServiceHealth;
    memory: ServiceHealth;
  };
  summary: string;
}

// ── Service Checkers ───────────────────────────────────────────

// Check 1: Can we talk to the Supabase database?
async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("projects").select("id").limit(1);
    const latencyMs = Date.now() - start;

    if (error) throw error;

    const status = latencyMs > 500 ? "degraded" : "healthy";
    console.log(`[health] Database check: ${status} (${latencyMs}ms)`);

    return { status, latencyMs };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[health] Database check: DOWN — ${message}`);
    return {
      status: "down",
      latencyMs,
      error: "Database unreachable",
    };
  }
}

// Check 2: Is the AI provider gateway responding?
async function checkAiGateway(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const { getProviderHealth } = await import("@/lib/providers/index");
    const isHealthy = await getProviderHealth();
    const latencyMs = Date.now() - start;

    const status = isHealthy
      ? latencyMs > 500
        ? "degraded"
        : "healthy"
      : "down";
    console.log(`[health] AI Gateway check: ${status} (${latencyMs}ms)`);

    return { status, latencyMs };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[health] AI Gateway check: DOWN — ${message}`);
    return {
      status: "down",
      latencyMs,
      error: "AI gateway unreachable",
    };
  }
}

// Check 3: Is the memory service responding?
async function checkMemory(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("memory_namespaces")
      .select("id")
      .limit(1);
    const latencyMs = Date.now() - start;

    if (error) throw error;

    const status = latencyMs > 500 ? "degraded" : "healthy";
    console.log(`[health] Memory check: ${status} (${latencyMs}ms)`);

    return { status, latencyMs };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[health] Memory check: DOWN — ${message}`);
    return {
      status: "down",
      latencyMs,
      error: "Memory service unreachable",
    };
  }
}

// Helper: Determine overall status
// Exported so it can be unit tested independently
export function aggregateHealthData(
  services: Record<string, ServiceHealth>,
): ServiceStatus {
  const statuses = Object.values(services).map((s) => s.status);
  if (statuses.every((s) => s === "healthy")) return "healthy";
  if (statuses.some((s) => s === "down")) return "down";
  return "degraded";
}

// ── Helper: Save results to database ──────────────────────────
async function persistHealthChecks(
  services: Record<string, ServiceHealth>,
  projectId: string | null,
) {
  const supabase = createAdminClient();
  const rows = Object.entries(services).map(([name, data]) => ({
    service_name: name,
    status: data.status,
    latency_ms: data.latencyMs,
    error_message: data.error ?? null,
    project_id: projectId,
  }));

  const { error } = await supabase.from("health_checks").insert(rows);

  if (error) {
    console.error("[health] Failed to persist health checks:", error.message);
  } else {
    console.log(
      `[health] Persisted ${rows.length} health check row(s) to database`,
    );
  }
}

// ── Main Route Handler ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  console.log("[health] ── Route hit ──────────────────────────────────────");

  // Check for cron secret first
  const cronSecret = request.headers.get("x-cron-secret");
  const isCronRequest = cronSecret === process.env.CRON_SECRET;
  console.log("[health] Cron secret present:", !!cronSecret);
  console.log("[health] Is valid cron request:", isCronRequest);

  // Authenticate — check session unless it is a valid cron request
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  console.log("[health] Session present:", !!session);

  if (!session && !isCronRequest) {
    console.log("[health] Rejected — no session and no valid cron secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[health] Auth passed — running all three service checks...");

  // Run all three service checks IN PARALLEL
  const [dbResult, aiResult, memResult] = await Promise.allSettled([
    checkDatabase(),
    checkAiGateway(),
    checkMemory(),
  ]);

  console.log("[health] All checks complete:");
  console.log("  database  →", dbResult.status);
  console.log("  aiGateway →", aiResult.status);
  console.log("  memory    →", memResult.status);

  //Extract values — fall back to 'down' if a check itself crashed
  const services = {
    database:
      dbResult.status === "fulfilled"
        ? dbResult.value
        : { status: "down" as const, latencyMs: 0, error: "Check failed" },
    aiGateway:
      aiResult.status === "fulfilled"
        ? aiResult.value
        : { status: "down" as const, latencyMs: 0, error: "Check failed" },
    memory:
      memResult.status === "fulfilled"
        ? memResult.value
        : { status: "down" as const, latencyMs: 0, error: "Check failed" },
  };

  // Calculate overall status
  const overallStatus = aggregateHealthData(services);
  console.log("[health] Overall status:", overallStatus);
  console.log("[health] Services:", JSON.stringify(services, null, 2));

  //Get AI summary — falls back to static string internally if Gemini fails
  console.log("[health] Requesting AI summary from Gemini...");
  const summary = await generateHealthSummary({
    status: overallStatus,
    services,
  });
  console.log("[health] AI summary received:", summary);

  // Build the response object
  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services,
    summary,
  };

  // Save to DB — fire-and-forget, intentionally not awaited
  // so it does not slow down the response the user receives
  const projectId = request.nextUrl.searchParams.get("projectId");
  console.log("[health] Persisting to database (fire-and-forget)...");
  persistHealthChecks(services, projectId);

  console.log("[health] ── Route complete — returning 200 ────────────────");

  //Return JSON with 60-second cache header
  return NextResponse.json(response, {
    status: 200,
    headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate" },
  });
}

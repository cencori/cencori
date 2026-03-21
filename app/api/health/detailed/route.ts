import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { generateHealthSummary } from "@/lib/health-summary";

// ── Types ──────────────────────────────────────────────────────
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
    // A simple query to confirm the DB is reachable
    const { error } = await supabase.from("projects").select("id").limit(1);
    const latencyMs = Date.now() - start;

    if (error) throw error;

    return {
      status: latencyMs > 500 ? "degraded" : "healthy",
      latencyMs,
    };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: "Database unreachable", // Never expose real error details to client
    };
  }
}

// Check 2: Is the AI provider gateway responding?
async function checkAiGateway(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    // Import the provider system and ping it
    const { getProviderHealth } = await import("@/lib/providers/index");
    const isHealthy = await getProviderHealth();
    const latencyMs = Date.now() - start;

    return {
      status: isHealthy ? (latencyMs > 500 ? "degraded" : "healthy") : "down",
      latencyMs,
    };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: "AI gateway unreachable",
    };
  }
}

// Check 3: Is the memory service responding?
async function checkMemory(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const supabase = createAdminClient();
    // Memory service uses a specific table — adjust to Cencori's actual table
    const { error } = await supabase
      .from("memory_namespaces")
      .select("id")
      .limit(1);
    const latencyMs = Date.now() - start;

    if (error) throw error;

    return {
      status: latencyMs > 500 ? "degraded" : "healthy",
      latencyMs,
    };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: "Memory service unreachable",
    };
  }
}

// ── Helper: Determine overall status ──────────────────────────
// Exported so it can be unit tested independently (File 9)
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

  // Use upsert=false, just insert. Errors here should not fail the main response.
  const { error } = await supabase.from("health_checks").insert(rows);
  if (error)
    console.error("[health] Failed to persist health checks:", error.message);
}

// ── Main Route Handler ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  // 1. Authentication: reject unauthenticated requests
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Allow cron requests authenticated by CRON_SECRET header
  const cronSecret = request.headers.get("x-cron-secret");
  const isCronRequest = cronSecret === process.env.CRON_SECRET;

  if (!session && !isCronRequest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Run all three service checks IN PARALLEL
  //    Promise.allSettled never throws — each result is either
  //    { status: 'fulfilled', value: ... } or { status: 'rejected', reason: ... }
  const [dbResult, aiResult, memResult] = await Promise.allSettled([
    checkDatabase(),
    checkAiGateway(),
    checkMemory(),
  ]);

  // 3. Extract values — fall back to 'down' if a check itself crashed
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

  // 4. Calculate overall status
  const overallStatus = aggregateHealthData(services);

  // 5. Get AI summary (File 3). Falls back to static string internally.
  const summary = await generateHealthSummary({
    status: overallStatus,
    services,
  });

  // 6. Build the response object
  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services,
    summary,
  };

  // 7. Save to DB (fire-and-forget, don't await — don't slow the response)
  const projectId = request.nextUrl.searchParams.get("projectId");
  persistHealthChecks(services, projectId); // intentionally not awaited

  // 8. Return JSON. Cache for 60 seconds via Next.js cache headers.
  return NextResponse.json(response, {
    status: 200,
    headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate" },
  });
}

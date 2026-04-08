// import { NextRequest, NextResponse } from "next/server";
// import { createServerClient } from "@/lib/supabaseServer";
// import { createAdminClient } from "@/lib/supabaseAdmin";
// import {
//   pingModel,
//   determineStatus,
//   calculateUptimePercentage,
//   sanitizeErrorMessage,
//   ModelHealthResult,
// } from "@/lib/model-health-utils";

// // ── Rate limiter for manual checks (max 5 per minute per user) ───
// const manualCheckRateMap = new Map<
//   string,
//   { count: number; resetAt: number }
// >();

// function checkManualRateLimit(userId: string): boolean {
//   const now = Date.now();
//   const limit = 5;
//   const entry = manualCheckRateMap.get(userId);

//   if (!entry || now > entry.resetAt) {
//     manualCheckRateMap.set(userId, { count: 1, resetAt: now + 60_000 });
//     return true;
//   }
//   if (entry.count >= limit) return false;
//   entry.count++;
//   return true;
// }

// // ── GET — return current status of all models ────────────────────
// export async function GET(
//   request: NextRequest,
//   { params }: { params: { projectId: string } },
// ) {
//   const { projectId } = params;

//   // 1. Authenticate
//   const supabase = await createServerClient();
//   const {
//     data: { session },
//   } = await supabase.auth.getSession();
//   if (!session) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   const admin = createAdminClient();

//   // 2. Verify project membership
//   const { data: membership } = await admin
//     .from("organization_members")
//     .select("id")
//     .eq("user_id", session.user.id)
//     .single();

//   if (!membership) {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   }

//   // 3. Get the most recent check for each model in this project
//   //    Using a subquery approach: fetch all checks from the last 24h,
//   //    then deduplicate by model_name keeping only the latest
//   const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

//   const { data: allChecks, error } = await admin
//     .from("model_health_checks")
//     .select(
//       "model_name, provider, status, latency_ms, error_message, checked_at",
//     )
//     .eq("project_id", projectId)
//     .gte("checked_at", since24h)
//     .order("checked_at", { ascending: false });

//   if (error) {
//     console.error("[health GET] Query failed:", error.message);
//     return NextResponse.json({ error: "Query failed" }, { status: 500 });
//   }

//   // 4. Group by model — keep all checks for uptime, but only latest for status
//   const modelMap = new Map<
//     string,
//     {
//       latest: (typeof allChecks)[0];
//       allChecks: typeof allChecks;
//     }
//   >();

//   for (const check of allChecks ?? []) {
//     const existing = modelMap.get(check.model_name);
//     if (!existing) {
//       modelMap.set(check.model_name, { latest: check, allChecks: [check] });
//     } else {
//       existing.allChecks.push(check);
//     }
//   }

//   // 5. Build the response array
//   const models: ModelHealthResult[] = Array.from(modelMap.entries()).map(
//     ([modelName, { latest, allChecks: checks }]) => ({
//       model: modelName,
//       provider: latest.provider,
//       status: latest.status as ModelHealthResult["status"],
//       latencyMs: latest.latency_ms ?? 0,
//       lastChecked: latest.checked_at,
//       uptime24h: calculateUptimePercentage(checks),
//       // Circuit breaker status — 'closed' = healthy, 'open' = tripped
//       // For now we infer from status; integrate circuit-breaker.ts later
//       circuitBreaker:
//         latest.status === "unavailable"
//           ? "open"
//           : latest.status === "degraded"
//             ? "half-open"
//             : "closed",
//     }),
//   );

//   // Sort: unavailable first, then degraded, then available
//   const order = { unavailable: 0, degraded: 1, available: 2 };
//   models.sort((a, b) => order[a.status] - order[b.status]);

//   return NextResponse.json(
//     { models },
//     {
//       headers: { "Cache-Control": "no-store" }, // always fresh data
//     },
//   );
// }

// // ── POST — trigger a manual health check for one model ───────────
// export async function POST(
//   request: NextRequest,
//   { params }: { params: { projectId: string } },
// ) {
//   const { projectId } = params;

//   // 1. Authenticate
//   const supabase = await createServerClient();
//   const {
//     data: { session },
//   } = await supabase.auth.getSession();
//   if (!session) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   // 2. Rate limit manual checks
//   if (!checkManualRateLimit(session.user.id)) {
//     return NextResponse.json(
//       { error: "Rate limit exceeded. Max 5 manual checks per minute." },
//       { status: 429 },
//     );
//   }

//   // 3. Validate body
//   const body = await request.json().catch(() => ({}));
//   const { modelName, provider } = body as {
//     modelName?: string;
//     provider?: string;
//   };

//   if (!modelName || !provider) {
//     return NextResponse.json(
//       { error: "modelName and provider are required" },
//       { status: 400 },
//     );
//   }

//   // 4. Run the health ping
//   const { latencyMs, error: pingError } = await pingModel(modelName, provider);
//   const status = determineStatus(latencyMs, !!pingError);

//   // 5. Write result to DB
//   const admin = createAdminClient();
//   await admin.from("model_health_checks").insert({
//     project_id: projectId,
//     model_name: modelName,
//     provider,
//     status,
//     latency_ms: latencyMs,
//     error_message: pingError ? sanitizeErrorMessage(pingError) : null,
//   });

//   // 6. Fetch updated 24h uptime for this model
//   const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
//   const { data: recentChecks } = await admin
//     .from("model_health_checks")
//     .select("status")
//     .eq("project_id", projectId)
//     .eq("model_name", modelName)
//     .gte("checked_at", since24h);

//   const uptime24h = calculateUptimePercentage(recentChecks ?? []);

//   // 7. Return the updated model status
//   const result: ModelHealthResult = {
//     model: modelName,
//     provider,
//     status,
//     latencyMs,
//     lastChecked: new Date().toISOString(),
//     uptime24h,
//     circuitBreaker:
//       status === "unavailable"
//         ? "open"
//         : status === "degraded"
//           ? "half-open"
//           : "closed",
//   };

//   return NextResponse.json({ model: result });
// }
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  pingModel,
  determineStatus,
  calculateUptimePercentage,
  sanitizeErrorMessage,
  ModelHealthResult,
} from "@/lib/model-health-utils";

// ── Rate limiter for manual checks (max 5 per minute per user) ───
const manualCheckRateMap = new Map<
  string,
  { count: number; resetAt: number }
>();

function checkManualRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = 5;
  const entry = manualCheckRateMap.get(userId);

  if (!entry || now > entry.resetAt) {
    manualCheckRateMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ── GET — return current status of all models ────────────────────
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;

  console.log("[health/providers] ── GET hit ──────────────────────────────");
  console.log("[health/providers] projectId:", projectId);

  //Authenticate
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log("[health/providers] Session present:", !!session);

  if (!session) {
    console.log("[health/providers] Rejected — no session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 2. Verify project membership
  const { data: project } = await admin
    .from("projects")
    .select("organization_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    console.log("[health/providers] Rejected — project not found:", projectId);
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", project.organization_id)
    .eq("user_id", session.user.id)
    .single();

  console.log("[health/providers] Membership found in org:", !!membership);

  if (!membership) {
    console.log(
      "[health/providers] Rejected — user not in org:",
      project.organization_id,
    );
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // 3. Get the most recent check for each model in this project
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  console.log("[health/providers] Querying health checks since:", since24h);

  const { data: allChecks, error } = await admin
    .from("model_health_checks")
    .select(
      "model_name, provider, status, latency_ms, error_message, checked_at",
    )
    .eq("project_id", projectId)
    .gte("checked_at", since24h)
    .order("checked_at", { ascending: false });

  if (error) {
    console.error("[health/providers] DB query failed:", error.message);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  console.log(
    "[health/providers] Total check rows returned:",
    allChecks?.length ?? 0,
  );

  // 4. Group by model — keep all checks for uptime, only latest for status
  const modelMap = new Map<
    string,
    {
      latest: (typeof allChecks)[0];
      allChecks: typeof allChecks;
    }
  >();

  for (const check of allChecks ?? []) {
    const existing = modelMap.get(check.model_name);
    if (!existing) {
      modelMap.set(check.model_name, { latest: check, allChecks: [check] });
    } else {
      existing.allChecks.push(check);
    }
  }

  console.log("[health/providers] Unique models found:", modelMap.size);

  // 5. Build the response array
  const models: ModelHealthResult[] = Array.from(modelMap.entries()).map(
    ([modelName, { latest, allChecks: checks }]) => {
      const uptime = calculateUptimePercentage(checks);
      const result: ModelHealthResult = {
        model: modelName,
        provider: latest.provider,
        status: latest.status as ModelHealthResult["status"],
        latencyMs: latest.latency_ms ?? 0,
        lastChecked: latest.checked_at,
        uptime24h: uptime,
        circuitBreaker:
          latest.status === "unavailable"
            ? "open"
            : latest.status === "degraded"
              ? "half-open"
              : "closed",
      };
      console.log(
        `[health/providers]   ${modelName}: ${result.status} (${result.latencyMs}ms, ${result.uptime24h}% uptime, circuit: ${result.circuitBreaker})`,
      );
      return result;
    },
  );

  // Sort: unavailable first, then degraded, then available
  const order = { unavailable: 0, degraded: 1, available: 2 };
  models.sort((a, b) => order[a.status] - order[b.status]);

  console.log(
    "[health/providers] Models sorted — order:",
    models.map((m) => m.status).join(", "),
  );
  console.log("[health/providers] ── GET complete — returning 200 ─────────");

  return NextResponse.json(
    { models },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

// ── POST — trigger a manual health check for one model ───────────
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;

  console.log("[health/providers] ── POST hit ─────────────────────────────");
  console.log("[health/providers] projectId:", projectId);

  // 1. Authenticate
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log("[health/providers] Session present:", !!session);

  if (!session) {
    console.log("[health/providers] Rejected — no session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit manual checks
  if (!checkManualRateLimit(session.user.id)) {
    console.log(
      "[health/providers] Rejected — rate limit exceeded for user:",
      session.user.id,
    );
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 5 manual checks per minute." },
      { status: 429 },
    );
  }

  console.log("[health/providers] Rate limit passed");

  // 3. Validate body
  const body = await request.json().catch(() => ({}));
  const { modelName, provider } = body as {
    modelName?: string;
    provider?: string;
  };

  console.log(
    "[health/providers] Requested model:",
    modelName,
    "provider:",
    provider,
  );

  if (!modelName || !provider) {
    console.log("[health/providers] Rejected — missing modelName or provider");
    return NextResponse.json(
      { error: "modelName and provider are required" },
      { status: 400 },
    );
  }

  // 4. Run the health ping
  console.log(`[health/providers] Pinging ${modelName} (${provider})...`);
  const { latencyMs, error: pingError } = await pingModel(modelName, provider);
  const status = determineStatus(latencyMs, !!pingError);

  console.log(`[health/providers] Ping result: ${status} (${latencyMs}ms)`);
  if (pingError) {
    console.error("[health/providers] Ping error:", pingError);
  }

  // 5. Write result to DB
  const admin = createAdminClient();

  console.log("[health/providers] Writing result to DB...");

  await admin.from("model_health_checks").insert({
    project_id: projectId,
    model_name: modelName,
    provider,
    status,
    latency_ms: latencyMs,
    error_message: pingError ? sanitizeErrorMessage(pingError) : null,
  });

  console.log("[health/providers] DB write complete");

  // 6. Fetch updated 24h uptime for this model
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentChecks } = await admin
    .from("model_health_checks")
    .select("status")
    .eq("project_id", projectId)
    .eq("model_name", modelName)
    .gte("checked_at", since24h);

  const uptime24h = calculateUptimePercentage(recentChecks ?? []);

  // 7. Return the updated model status
  const result: ModelHealthResult = {
    model: modelName,
    provider,
    status,
    latencyMs,
    lastChecked: new Date().toISOString(),
    uptime24h,
    circuitBreaker:
      status === "unavailable"
        ? "open"
        : status === "degraded"
          ? "half-open"
          : "closed",
  };

  console.log("[health/providers] ── POST complete — returning 200 ────────");

  return NextResponse.json({ model: result });
}

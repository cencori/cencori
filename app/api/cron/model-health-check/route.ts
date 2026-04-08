export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  pingModel,
  determineStatus,
  sanitizeErrorMessage,
} from "@/lib/model-health-utils";

// ── Failure tracker ──────────────────────────────
const failureStreak = new Map<string, number>();

export async function GET(request: NextRequest) {
  // 1. Verify cron secret (SECURE)
  const secret = request.headers.get("x-cron-secret");

  // if (!secret || secret !== process.env.CRON_SECRET) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  if (process.env.NODE_ENV === "production") {
    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const start = Date.now();

  let modelsChecked = 0;
  let available = 0;
  let degraded = 0;
  let unavailable = 0;

  // 2. Fetch projects
  const { data: projects, error: projectsError } = await admin
    .from("projects")
    .select("id, provider_config")
    .limit(100);

  if (projectsError || !projects) {
    return NextResponse.json(
      { ok: false, error: "Failed to fetch projects" },
      { status: 500 },
    );
  }

  // 3. Sequential checks (safe for rate limits)
  for (const project of projects) {
    const config = project.provider_config as {
      model?: string;
      provider?: string;
    } | null;

    if (!config?.model || !config?.provider) {
      continue;
    }

    const modelName = config.model;
    const provider = config.provider;

    modelsChecked++;

    const { latencyMs, error: pingError } = await pingModel(
      modelName,
      provider,
    );

    const status = determineStatus(latencyMs, !!pingError);

    // Write to DB
    const { error: insertError } = await admin
      .from("model_health_checks")
      .insert({
        project_id: project.id,
        model_name: modelName,
        provider,
        status,
        latency_ms: latencyMs,
        error_message: pingError ? sanitizeErrorMessage(pingError) : null,
      });

    if (insertError) {
      console.error(
        `[model-health] DB insert failed for ${modelName}: ${insertError.message}`,
      );
    }

    // Counters
    if (status === "available") available++;
    else if (status === "degraded") degraded++;
    else unavailable++;

    // Failure tracking (only logs on serious issue)
    const key = `${project.id}:${modelName}`;

    if (status === "unavailable") {
      const streak = (failureStreak.get(key) ?? 0) + 1;
      failureStreak.set(key, streak);

      if (streak >= 3) {
        console.error(
          `[model-health] ALERT: ${modelName} unavailable (${streak}x)`,
        );
      }
    } else {
      failureStreak.set(key, 0);
    }

    // Rate limit protection
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // 4. Cleanup old records
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { count: deletedRows } = await admin
    .from("model_health_checks")
    .delete({ count: "exact" })
    .lt("checked_at", cutoff7d);

  const durationMs = Date.now() - start;

  return NextResponse.json({
    ok: true,
    modelsChecked,
    available,
    degraded,
    unavailable,
    deletedRows: deletedRows ?? 0,
    durationMs,
  });
}

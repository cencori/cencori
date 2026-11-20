import { NextRequest, NextResponse } from "next/server";
import { clampTimeRange, type SubscriptionTier } from "@/lib/entitlements";
import { isUuid, requireOAuth } from "@/lib/oauth/api";

const RANGE_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

type Rollup = {
  total_requests?: number;
  successful_requests?: number;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_cost?: number;
  total_spend?: number;
  avg_latency?: number;
  model_usage?: Record<string, number>;
  provider_usage?: Record<string, number>;
};

/**
 * GET /v1/organization/usage — requests, tokens and cost for the organization's projects.
 * Needs usage:read.
 *
 * Query: `range` (1h, 24h, 7d, 30d, 90d; default 7d), `project_id` to look at one project.
 * How far back it goes follows the organization's plan, as the dashboard does; the range used
 * is in the answer.
 */
export async function GET(request: NextRequest) {
  const auth = await requireOAuth(request, "usage:read");
  if ("response" in auth) return auth.response;
  const { call } = auth;

  const url = new URL(request.url);
  const projectId = url.searchParams.get("project_id");
  if (projectId !== null && !isUuid(projectId)) {
    return call.fail(400, "invalid_request_error", "project_id is not a valid ID.", "project_id");
  }

  const { data: org } = await call.db
    .from("organizations")
    .select("subscription_tier")
    .eq("id", call.organizationId)
    .maybeSingle();
  const tier = ((org as { subscription_tier?: string } | null)?.subscription_tier ?? "free") as SubscriptionTier;
  const asked = url.searchParams.get("range") || "7d";
  let range = clampTimeRange(tier, asked);
  if (range === "all") range = "90d";

  let query = call.db.from("projects").select("id").eq("organization_id", call.organizationId);
  if (projectId) query = query.eq("id", projectId);
  const { data: projects, error: projectsError } = await query;
  if (projectsError) return call.fail(500, "server_error", "Cencori could not load the projects.");
  const projectIds = ((projects ?? []) as Array<{ id: string }>).map((project) => project.id);
  if (projectId && projectIds.length === 0) {
    return call.fail(404, "project_not_found", "No project with this ID in the organization.", "project_id");
  }

  const empty = {
    object: "usage" as const,
    range,
    project_id: projectId,
    requests: 0,
    successful_requests: 0,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    cost_usd: 0,
    average_latency_ms: 0,
    by_model: {} as Record<string, number>,
    by_provider: {} as Record<string, number>,
  };
  if (projectIds.length === 0) return NextResponse.json(empty);

  const { data, error } = await call.db.rpc("org_usage_stats", {
    p_project_ids: projectIds,
    p_start: new Date(Date.now() - RANGE_MS[range]).toISOString(),
  });
  if (error) {
    console.error("[OAuth API] org_usage_stats failed", error);
    return call.fail(500, "server_error", "Cencori could not load usage.");
  }
  const rollup = (data ?? {}) as Rollup;
  return NextResponse.json({
    ...empty,
    requests: rollup.total_requests ?? 0,
    successful_requests: rollup.successful_requests ?? 0,
    input_tokens: rollup.input_tokens ?? 0,
    output_tokens: rollup.output_tokens ?? 0,
    total_tokens: rollup.total_tokens ?? 0,
    cost_usd: rollup.total_spend ?? rollup.total_cost ?? 0,
    average_latency_ms: rollup.avg_latency ?? 0,
    by_model: rollup.model_usage ?? {},
    by_provider: rollup.provider_usage ?? {},
  });
}

import { NextRequest, NextResponse } from "next/server";
import { requireOAuth } from "@/lib/oauth/api";

/**
 * GET /v1/organization — the organization this token was authorized for.
 * Needs organization:read.
 */
export async function GET(request: NextRequest) {
  const auth = await requireOAuth(request, "organization:read");
  if ("response" in auth) return auth.response;
  const { call } = auth;

  const { data, error } = await call.db
    .from("organizations")
    .select("id, name, slug, subscription_tier, created_at")
    .eq("id", call.organizationId)
    .maybeSingle();
  if (error || !data) return call.fail(404, "organization_not_found", "The organization no longer exists.");

  const { count } = await call.db
    .from("organization_members")
    .select("user_id", { count: "exact", head: true })
    .eq("organization_id", call.organizationId);

  return NextResponse.json({
    id: data.id,
    object: "organization",
    name: data.name,
    slug: data.slug,
    plan: data.subscription_tier ?? "free",
    member_count: count ?? 0,
    created_at: data.created_at,
  });
}

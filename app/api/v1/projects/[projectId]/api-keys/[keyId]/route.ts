import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { findProject, isUuid, requireOAuth } from "@/lib/oauth/api";

type RouteContext = { params: Promise<{ projectId: string; keyId: string }> };

/**
 * DELETE /v1/projects/{id}/api-keys/{key_id} — revoke a key. Needs api_keys:write.
 * The key stops working at once and cannot be brought back.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireOAuth(request, "api_keys:write");
  if ("response" in auth) return auth.response;
  const { call } = auth;

  const { projectId, keyId } = await params;
  const project = await findProject(call, projectId);
  if (!project) return call.fail(404, "project_not_found", "No project with this ID in the organization.");
  if (!isUuid(keyId)) return call.fail(404, "api_key_not_found", "No API key with this ID in the project.");

  const { data, error } = await call.db
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("project_id", project.id)
    .is("revoked_at", null)
    .select("id, name, key_prefix")
    .maybeSingle();
  if (error) {
    console.error("[OAuth API] api key revoke failed", error);
    return call.fail(500, "server_error", "Cencori could not revoke the API key.");
  }
  if (!data) return call.fail(404, "api_key_not_found", "No active API key with this ID in the project.");

  writeAuditLog({
    organizationId: call.organizationId,
    projectId: project.id,
    category: "api_key",
    action: "revoked",
    resourceType: "api_key",
    resourceId: data.id,
    actorId: call.userId,
    actorType: "api",
    description: `The app "${call.appName}" revoked the API key "${data.name}"`,
    metadata: { oauth_app: call.appName, oauth_app_id: call.appId, key_prefix: data.key_prefix },
  });
  return NextResponse.json({ id: data.id, object: "api_key", revoked: true });
}

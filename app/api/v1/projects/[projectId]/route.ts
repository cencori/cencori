import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { PROJECT_COLUMNS, findProject, projectView, readJsonObject, requireOAuth, type ProjectRow } from "@/lib/oauth/api";

type RouteContext = { params: Promise<{ projectId: string }> };

/** GET /v1/projects/{id} — one project. Needs projects:read. */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireOAuth(request, "projects:read");
  if ("response" in auth) return auth.response;
  const { call } = auth;

  const project = await findProject(call, (await params).projectId);
  if (!project) return call.fail(404, "project_not_found", "No project with this ID in the organization.");
  return NextResponse.json(projectView(project));
}

/**
 * PATCH /v1/projects/{id} — change a project's name or description. Needs projects:write.
 * The slug does not change with the name, so links to the project keep working.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireOAuth(request, "projects:write");
  if ("response" in auth) return auth.response;
  const { call } = auth;

  const project = await findProject(call, (await params).projectId);
  if (!project) return call.fail(404, "project_not_found", "No project with this ID in the organization.");

  const body = await readJsonObject(request);
  if (!body) return call.fail(400, "invalid_request_error", "The request body must be a JSON object.");
  const changes: { name?: string; description?: string | null } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length === 0 || name.length > 60) {
      return call.fail(400, "invalid_request_error", "name can be 1 to 60 characters.", "name");
    }
    changes.name = name;
  }
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") {
      return call.fail(400, "invalid_request_error", "description must be text or null.", "description");
    }
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length > 200) {
      return call.fail(400, "invalid_request_error", "description can be up to 200 characters.", "description");
    }
    changes.description = description || null;
  }
  if (Object.keys(changes).length === 0) {
    return call.fail(400, "invalid_request_error", "Send name or description to change.");
  }

  const { data, error } = await call.db
    .from("projects")
    .update(changes)
    .eq("id", project.id)
    .eq("organization_id", call.organizationId)
    .select(PROJECT_COLUMNS)
    .single();
  if (error || !data) {
    console.error("[OAuth API] project update failed", error);
    return call.fail(500, "server_error", "Cencori could not update the project.");
  }

  writeAuditLog({
    organizationId: call.organizationId,
    projectId: project.id,
    category: "project",
    action: "updated",
    resourceType: "project",
    resourceId: project.id,
    actorId: call.userId,
    actorType: "api",
    description: `The app "${call.appName}" updated the project "${project.name}"`,
    metadata: { oauth_app: call.appName, oauth_app_id: call.appId, changed: Object.keys(changes) },
  });
  return NextResponse.json(projectView(data as ProjectRow));
}

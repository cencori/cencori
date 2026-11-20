import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { PROJECT_COLUMNS, projectView, readJsonObject, requireOAuth, type ProjectRow } from "@/lib/oauth/api";
import { isReservedProjectSlug } from "@/lib/reserved-slugs";
import { slugify } from "@/lib/utils";

/** The region new projects are created in, as the dashboard's form does by default. */
const DEFAULT_REGION = "af-south-1";

/** GET /v1/projects — the organization's projects, oldest first. Needs projects:read. */
export async function GET(request: NextRequest) {
  const auth = await requireOAuth(request, "projects:read");
  if ("response" in auth) return auth.response;
  const { call } = auth;

  const { data, error } = await call.db
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("organization_id", call.organizationId)
    .order("created_at", { ascending: true });
  if (error) return call.fail(500, "server_error", "Cencori could not load the projects.");
  return NextResponse.json({ object: "list", data: ((data ?? []) as ProjectRow[]).map(projectView) });
}

/**
 * POST /v1/projects — create a project. Needs projects:write.
 *
 * Body: `name` (required, up to 60 characters), `description` (optional, up to 200). The plan's
 * limit on projects applies as it does in the dashboard: the Free plan has one.
 */
export async function POST(request: NextRequest) {
  const auth = await requireOAuth(request, "projects:write");
  if ("response" in auth) return auth.response;
  const { call } = auth;

  const body = await readJsonObject(request);
  if (!body) return call.fail(400, "invalid_request_error", "The request body must be a JSON object.");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length === 0 || name.length > 60) {
    return call.fail(400, "invalid_request_error", "name is required and can be up to 60 characters.", "name");
  }
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > 200) {
    return call.fail(400, "invalid_request_error", "description can be up to 200 characters.", "description");
  }

  const base = slugify(name) || "project";
  const { data: taken } = await call.db
    .from("projects")
    .select("slug")
    .eq("organization_id", call.organizationId);
  const used = new Set(((taken ?? []) as Array<{ slug: string }>).map((row) => row.slug));
  let slug = base;
  for (let n = 2; used.has(slug) || isReservedProjectSlug(slug); n += 1) slug = `${base}-${n}`;

  // Two creates at once can pick the same slug; the database refuses the second (23505) and it
  // is tried again under the next free name.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await call.db
      .from("projects")
      .insert({
        name,
        slug,
        description: description || null,
        organization_id: call.organizationId,
        visibility: "private",
        region: DEFAULT_REGION,
      })
      .select(PROJECT_COLUMNS)
      .single();

    if (!error && data) {
      const project = data as ProjectRow;
      writeAuditLog({
        organizationId: call.organizationId,
        projectId: project.id,
        category: "project",
        action: "created",
        resourceType: "project",
        resourceId: project.id,
        actorId: call.userId,
        actorType: "api",
        description: `The app "${call.appName}" created the project "${project.name}"`,
        metadata: { oauth_app: call.appName, oauth_app_id: call.appId },
      });
      return NextResponse.json(projectView(project), { status: 201 });
    }

    const message = error?.message ?? "";
    if (message.includes("project_limit_reached")) {
      return call.fail(
        402,
        "project_limit_reached",
        "The Free plan includes 1 project. The organization needs Pro for more.",
      );
    }
    if (message.includes("pro_required")) {
      return call.fail(402, "pro_required", "This organization needs Pro before it can create projects.");
    }
    if (error?.code !== "23505") {
      console.error("[OAuth API] project insert failed", error);
      return call.fail(500, "server_error", "Cencori could not create the project.");
    }
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return call.fail(409, "conflict", "A project with this name was just created. Try again.");
}

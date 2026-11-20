import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashApiKey } from "@/lib/api-keys";
import { writeAuditLog } from "@/lib/audit-log";
import { API_KEY_COLUMNS, apiKeyView, findProject, readJsonObject, requireOAuth, type ApiKeyRow } from "@/lib/oauth/api";

type RouteContext = { params: Promise<{ projectId: string }> };

/** Keys that work now, for one project. A revoked key is not listed. */
const MAX_KEYS_PER_PROJECT = 50;

/** GET /v1/projects/{id}/api-keys — the project's keys, without their values. Needs api_keys:read. */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireOAuth(request, "api_keys:read");
  if ("response" in auth) return auth.response;
  const { call } = auth;

  const project = await findProject(call, (await params).projectId);
  if (!project) return call.fail(404, "project_not_found", "No project with this ID in the organization.");

  const { data, error } = await call.db
    .from("api_keys")
    .select(API_KEY_COLUMNS)
    .eq("project_id", project.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: true });
  if (error) return call.fail(500, "server_error", "Cencori could not load the API keys.");
  return NextResponse.json({ object: "list", data: ((data ?? []) as ApiKeyRow[]).map(apiKeyView) });
}

/**
 * POST /v1/projects/{id}/api-keys — create a key. Needs api_keys:write.
 *
 * Body: `name` (required), `environment` (production or test; default production), `type`
 * (secret or publishable; default secret), `allowed_domains` (required for a publishable key).
 * The key's value is in the answer as `key` and is never shown again.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireOAuth(request, "api_keys:write");
  if ("response" in auth) return auth.response;
  const { call } = auth;

  const project = await findProject(call, (await params).projectId);
  if (!project) return call.fail(404, "project_not_found", "No project with this ID in the organization.");

  const body = await readJsonObject(request);
  if (!body) return call.fail(400, "invalid_request_error", "The request body must be a JSON object.");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length === 0 || name.length > 80) {
    return call.fail(400, "invalid_request_error", "name is required and can be up to 80 characters.", "name");
  }
  const environment = body.environment ?? "production";
  if (environment !== "production" && environment !== "test") {
    return call.fail(400, "invalid_request_error", "environment must be production or test.", "environment");
  }
  const type = body.type ?? "secret";
  if (type !== "secret" && type !== "publishable") {
    return call.fail(400, "invalid_request_error", "type must be secret or publishable.", "type");
  }
  let allowedDomains: string[] | null = null;
  if (type === "publishable") {
    const domains = Array.isArray(body.allowed_domains) ? body.allowed_domains : [];
    const valid =
      domains.length > 0 &&
      domains.length <= 20 &&
      domains.every((domain) => typeof domain === "string" && domain.trim().length > 0 && domain.length <= 253);
    if (!valid) {
      return call.fail(
        400,
        "invalid_request_error",
        "A publishable key needs allowed_domains: 1 to 20 domain names.",
        "allowed_domains",
      );
    }
    allowedDomains = (domains as string[]).map((domain) => domain.trim());
  }

  const { count } = await call.db
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_KEYS_PER_PROJECT) {
    return call.fail(409, "api_key_limit_reached", `A project can have ${MAX_KEYS_PER_PROJECT} active keys. Revoke one first.`);
  }

  // The same format the dashboard issues (app/api/projects/[projectId]/api-keys/route.ts).
  const prefix = `${type === "publishable" ? "cpk" : "csk"}${environment === "test" ? "_test" : ""}_`;
  const key = `${prefix}${crypto.randomBytes(24).toString("hex")}`;
  const { data, error } = await call.db
    .from("api_keys")
    .insert({
      project_id: project.id,
      name,
      key_prefix: `${key.substring(0, prefix.length + 4)}...`,
      key_hash: hashApiKey(key),
      created_by: call.userId,
      environment,
      key_type: type,
      allowed_domains: allowedDomains,
    })
    .select(API_KEY_COLUMNS)
    .single();
  if (error || !data) {
    console.error("[OAuth API] api key insert failed", error);
    return call.fail(500, "server_error", "Cencori could not create the API key.");
  }
  const row = data as ApiKeyRow;

  writeAuditLog({
    organizationId: call.organizationId,
    projectId: project.id,
    category: "api_key",
    action: "created",
    resourceType: "api_key",
    resourceId: row.id,
    actorId: call.userId,
    actorType: "api",
    description: `The app "${call.appName}" created the ${type} API key "${name}" for ${environment}`,
    metadata: { oauth_app: call.appName, oauth_app_id: call.appId, key_name: name, key_prefix: row.key_prefix, environment, key_type: type },
  });
  return NextResponse.json({ ...apiKeyView(row), key }, { status: 201 });
}

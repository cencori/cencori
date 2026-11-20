import "server-only";

import crypto from "crypto";
import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractBearerToken } from "@/lib/api-keys";
import { embeddedError } from "@/lib/embedded/http";
import { checkCustomRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { isAccessToken, scopeAllows, type OAuthScope } from "./protocol";
import { verifyAccessToken, type AccessContext } from "./store";

/**
 * The management API (/v1/organization, /v1/projects): what an OAuth access token can call.
 * Every route starts with requireOAuth, which says who the token speaks for and refuses a token
 * that lacks the permission the route needs.
 */

/** Requests a minute for one authorization. Management calls are setup work, not traffic. */
const PER_GRANT_LIMIT = 120;

export type OAuthCall = AccessContext & {
  db: SupabaseClient;
  requestId: string;
  fail: (status: number, code: string, message: string, param?: string) => NextResponse;
};

export async function requireOAuth(
  request: Request,
  needed: OAuthScope,
): Promise<{ call: OAuthCall } | { response: NextResponse }> {
  const requestId = crypto.randomUUID();
  const fail = (status: number, code: string, message: string, param?: string) =>
    embeddedError(status, code, message, {
      requestId,
      param,
      type: status === 401 ? "authentication_error" : status === 403 ? "permission_error" : undefined,
    });

  const bearer = extractBearerToken(request.headers.get("authorization"));
  if (!isAccessToken(bearer)) {
    return {
      response: fail(
        401,
        "invalid_token",
        "This endpoint needs an OAuth access token (cat_…) in the Authorization header. See https://cencori.com/docs/oauth.",
      ),
    };
  }

  const db = createAdminClient();
  const context = await verifyAccessToken(db, bearer);
  if (!context) {
    return { response: fail(401, "invalid_token", "This access token is invalid, expired or has been revoked.") };
  }

  const limit = await checkCustomRateLimit(`oauth_api:${context.grantId}`, PER_GRANT_LIMIT, 60);
  if (!limit.allowed) {
    return { response: fail(429, "rate_limit_exceeded", "Too many requests. Try again shortly.") };
  }

  if (!scopeAllows(context.scopes, needed)) {
    return {
      response: fail(403, "insufficient_scope", `This token does not have the ${needed} permission.`),
    };
  }
  return { call: { ...context, db, requestId, fail } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  region: string | null;
  status: string;
  created_at: string;
};

export const PROJECT_COLUMNS = "id, name, slug, description, region, status, created_at";

/** A project as the API shows it. */
export function projectView(row: ProjectRow) {
  return {
    id: row.id,
    object: "project" as const,
    name: row.name,
    slug: row.slug,
    description: row.description,
    region: row.region,
    status: row.status,
    created_at: row.created_at,
  };
}

/** The token's organization's project with this ID, or null. Another organization's is null too. */
export async function findProject(call: OAuthCall, projectId: string): Promise<ProjectRow | null> {
  if (!isUuid(projectId)) return null;
  const { data } = await call.db
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", projectId)
    .eq("organization_id", call.organizationId)
    .maybeSingle();
  return (data as ProjectRow | null) ?? null;
}

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  environment: string;
  key_type: string | null;
  allowed_domains: string[] | null;
  created_at: string;
  last_used_at: string | null;
};

export const API_KEY_COLUMNS =
  "id, name, key_prefix, environment, key_type, allowed_domains, created_at, last_used_at";

/** An API key as the API shows it. The key's value is not here: it is returned once, on creation. */
export function apiKeyView(row: ApiKeyRow) {
  return {
    id: row.id,
    object: "api_key" as const,
    name: row.name,
    key_prefix: row.key_prefix,
    environment: row.environment,
    type: row.key_type ?? "secret",
    allowed_domains: row.allowed_domains,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
  };
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

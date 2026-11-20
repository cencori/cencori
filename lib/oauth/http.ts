import "server-only";

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkCustomRateLimit } from "@/lib/rate-limit";
import { isClientId, isClientSecret, noStoreHeaders, type OAuthErrorCode } from "./protocol";
import { getAppByClientId, verifyClientSecret, type OAuthApp } from "./store";

/** Where Cencori OAuth is served from. Tokens name this as their issuer. */
export function oauthIssuer(): string {
  // Production is always cencori.com: NEXT_PUBLIC_APP_URL has named other hosts there before.
  const fallback =
    process.env.NODE_ENV === "production"
      ? "https://cencori.com"
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return (process.env.OAUTH_ISSUER_URL || fallback).replace(/\/+$/, "");
}

/** An error in the shape RFC 6749 §5.2 gives the token endpoint. */
export function oauthError(status: number, error: OAuthErrorCode, description: string, extra: HeadersInit = {}) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { ...noStoreHeaders(), ...extra } },
  );
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** A 429 when this address has asked too often, otherwise null. */
export async function limitOAuth(request: Request, endpoint: string, limit: number): Promise<NextResponse | null> {
  const result = await checkCustomRateLimit(`oauth:${endpoint}:${clientIp(request)}`, limit, 60);
  if (result.allowed) return null;
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return oauthError(429, "invalid_request", "Too many requests. Try again shortly.", {
    "Retry-After": String(retryAfter),
  });
}

/**
 * The fields of a token or revoke request. The standard asks for a form
 * (application/x-www-form-urlencoded); JSON is accepted too because it is what people send.
 */
export async function readOAuthBody(request: Request): Promise<Record<string, string> | null> {
  const type = (request.headers.get("content-type") ?? "").toLowerCase();
  try {
    if (type.includes("application/json")) {
      const body: unknown = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) return null;
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === "string") fields[key] = value;
      }
      return fields;
    }
    const form = new URLSearchParams(await request.text());
    return Object.fromEntries(form.entries());
  } catch {
    return null;
  }
}

/**
 * Which app is calling, proved by its secret: in the Authorization header (HTTP Basic,
 * client_secret_basic) or in the body (client_secret_post). A response when it cannot be told.
 */
export async function authenticateClient(
  db: SupabaseClient,
  request: Request,
  body: Record<string, string>,
): Promise<{ app: OAuthApp } | { response: NextResponse }> {
  let clientId = body.client_id;
  let clientSecret = body.client_secret;
  let viaHeader = false;

  const header = request.headers.get("authorization") ?? "";
  if (/^basic\s+/i.test(header)) {
    viaHeader = true;
    try {
      const decoded = Buffer.from(header.replace(/^basic\s+/i, ""), "base64").toString("utf8");
      const colon = decoded.indexOf(":");
      if (colon > 0) {
        clientId = decodeURIComponent(decoded.slice(0, colon));
        clientSecret = decodeURIComponent(decoded.slice(colon + 1));
      }
    } catch {
      clientId = "";
      clientSecret = "";
    }
  }

  const refused = () => ({
    response: oauthError(
      401,
      "invalid_client",
      "The client ID or client secret is not valid.",
      viaHeader ? { "WWW-Authenticate": 'Basic realm="Cencori OAuth"' } : {},
    ),
  });

  if (!isClientId(clientId) || !isClientSecret(clientSecret)) return refused();
  const app = await getAppByClientId(db, clientId);
  if (!app) return refused();
  if (!(await verifyClientSecret(db, app.id, clientSecret))) return refused();
  return { app };
}

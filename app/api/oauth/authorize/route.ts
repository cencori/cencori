import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { writeAuditLog } from "@/lib/audit-log";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import { authorizePath, checkAuthorizeRequest, errorRedirect, type AuthorizeParams } from "@/lib/oauth/authorize";
import { clientIp, limitOAuth } from "@/lib/oauth/http";
import { formatScopes, noStoreHeaders, redirectWith } from "@/lib/oauth/protocol";
import { createAuthorizationCode, organizationRole, roleMayGrant } from "@/lib/oauth/store";

function answer(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: noStoreHeaders() });
}

/** Whether the browser says the request was made by a page on this same host. */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * POST /api/oauth/authorize — the consent screen's Authorize and Cancel buttons.
 *
 * Called by the consent page with the person's session. It answers with the address to send the
 * browser to: the app's redirect address carrying a code, or carrying access_denied. The page
 * then goes there itself, which the site's form-action policy would stop a form from doing.
 */
export async function POST(request: NextRequest) {
  // Only the consent page may press these buttons. A page on another site cannot read the
  // answer, but it must not be able to cause a grant either.
  if (!sameOrigin(request)) return answer(403, { error: "This request did not come from Cencori." });

  const limited = await limitOAuth(request, "authorize", 30);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return answer(400, { error: "The request could not be read." });
  }
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : undefined);
  const params: AuthorizeParams = {
    response_type: "code",
    client_id: text("client_id"),
    redirect_uri: text("redirect_uri"),
    scope: text("scope"),
    state: text("state"),
    code_challenge: text("code_challenge"),
    code_challenge_method: "S256",
  };

  try {
    const supabase = await createServerClient();
    const { data } = await getAuthUser(supabase);
    const user = data.user;
    if (!user) {
      return answer(401, {
        error: "Your Cencori session expired.",
        login_url: `/login?redirect=${encodeURIComponent(authorizePath(params))}`,
      });
    }

    const db = createAdminClient();
    const check = await checkAuthorizeRequest(db, params);
    if (check.kind === "stop") return answer(400, { error: check.message });
    if (check.kind === "redirect") return answer(200, { redirect_url: check.url });
    const { app, redirectUri, scopes, state, codeChallenge } = check.request;

    if (body.decision === "deny") {
      return answer(200, {
        redirect_url: errorRedirect(redirectUri, state, "access_denied", "The request was declined."),
      });
    }
    if (body.decision !== "allow") return answer(400, { error: "decision must be allow or deny." });

    const organizationId = text("organization_id");
    if (!organizationId || !/^[0-9a-f-]{36}$/i.test(organizationId)) {
      return answer(400, { error: "Choose an organization." });
    }
    const role = await organizationRole(db, organizationId, user.id);
    if (!roleMayGrant(role, scopes)) {
      return answer(403, {
        error: scopes.includes("api_keys:write")
          ? "Only the organization's owner can let an app create API keys."
          : "Only an owner or admin can give an app access to this organization.",
      });
    }

    const code = await createAuthorizationCode(db, {
      app,
      organizationId,
      userId: user.id,
      scopes,
      redirectUri,
      codeChallenge,
    });

    writeAuditLog({
      organizationId,
      category: "integration",
      action: "configured",
      resourceType: "oauth_grant",
      resourceId: app.id,
      actorId: user.id,
      actorEmail: user.email ?? null,
      actorIp: clientIp(request),
      actorType: "user",
      description: `Authorized the app "${app.name}" to access the organization`,
      metadata: { app_name: app.name, client_id: app.client_id, scopes: formatScopes(scopes) },
    });

    return answer(200, { redirect_url: redirectWith(redirectUri, { code, state }) });
  } catch (error) {
    console.error("[OAuth] authorize failed", error);
    return answer(500, { error: "Cencori could not complete the authorization." });
  }
}

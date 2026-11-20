import { NextResponse } from "next/server";
import { oauthIssuer } from "@/lib/oauth/http";
import { OAUTH_SCOPES } from "@/lib/oauth/protocol";

/** RFC 8414: where Cencori OAuth's endpoints are and what it supports, for clients that look it up. */
export function GET() {
  const issuer = oauthIssuer();
  return NextResponse.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      revocation_endpoint: `${issuer}/api/oauth/revoke`,
      scopes_supported: OAUTH_SCOPES,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
      revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
      service_documentation: `${issuer}/docs/oauth`,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}

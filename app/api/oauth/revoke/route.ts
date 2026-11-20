import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { authenticateClient, limitOAuth, oauthError, readOAuthBody } from "@/lib/oauth/http";
import { isAccessToken, isRefreshToken, noStoreHeaders } from "@/lib/oauth/protocol";
import { revokeByToken } from "@/lib/oauth/store";

/**
 * POST /api/oauth/revoke — an app hands back a token it no longer needs (RFC 7009).
 *
 * Either an access token or a refresh token ends the authorization it came from. The answer is
 * 200 whether or not the token existed, as the standard asks, so nothing is learned by guessing.
 */
export async function POST(request: NextRequest) {
  const limited = await limitOAuth(request, "revoke", 60);
  if (limited) return limited;

  const body = await readOAuthBody(request);
  if (!body) return oauthError(400, "invalid_request", "The request body could not be read.");

  try {
    const db = createAdminClient();
    const client = await authenticateClient(db, request, body);
    if ("response" in client) return client.response;
    if (!body.token) return oauthError(400, "invalid_request", "token is required.");

    if (isAccessToken(body.token) || isRefreshToken(body.token)) {
      await revokeByToken(db, { app: client.app, token: body.token });
    }
    return new NextResponse(null, { status: 200, headers: noStoreHeaders() });
  } catch (error) {
    console.error("[OAuth] revoke endpoint failed", error);
    return oauthError(500, "server_error", "Cencori could not revoke the token.");
  }
}

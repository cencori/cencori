import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { authenticateClient, limitOAuth, oauthError, readOAuthBody } from "@/lib/oauth/http";
import { isAuthCode, isCodeVerifier, isRefreshToken, noStoreHeaders } from "@/lib/oauth/protocol";
import { exchangeCode, refreshTokens } from "@/lib/oauth/store";

/**
 * POST /api/oauth/token — a code, or a refresh token, for an access token (RFC 6749 §4.1.3, §6).
 *
 * Called by the app's server with its client ID and secret. An authorization code also needs the
 * PKCE verifier and the same redirect_uri the code was sent to.
 */
export async function POST(request: NextRequest) {
  const limited = await limitOAuth(request, "token", 60);
  if (limited) return limited;

  const body = await readOAuthBody(request);
  if (!body) return oauthError(400, "invalid_request", "The request body could not be read.");

  try {
    const db = createAdminClient();
    const client = await authenticateClient(db, request, body);
    if ("response" in client) return client.response;

    if (body.grant_type === "authorization_code") {
      if (!isAuthCode(body.code) || !isCodeVerifier(body.code_verifier) || !body.redirect_uri) {
        return oauthError(400, "invalid_request", "code, code_verifier and redirect_uri are required.");
      }
      const tokens = await exchangeCode(db, {
        app: client.app,
        code: body.code,
        redirectUri: body.redirect_uri,
        codeVerifier: body.code_verifier,
      });
      if (!tokens) {
        return oauthError(400, "invalid_grant", "The authorization code is invalid, expired or already used.");
      }
      return NextResponse.json(tokens, { headers: noStoreHeaders() });
    }

    if (body.grant_type === "refresh_token") {
      if (!isRefreshToken(body.refresh_token)) {
        return oauthError(400, "invalid_request", "refresh_token is required.");
      }
      const tokens = await refreshTokens(db, { app: client.app, refreshToken: body.refresh_token });
      if (!tokens) {
        return oauthError(400, "invalid_grant", "The refresh token is invalid, expired or already used.");
      }
      return NextResponse.json(tokens, { headers: noStoreHeaders() });
    }

    return oauthError(
      400,
      "unsupported_grant_type",
      "grant_type must be authorization_code or refresh_token.",
    );
  } catch (error) {
    console.error("[OAuth] token endpoint failed", error);
    return oauthError(500, "server_error", "Cencori could not issue a token.");
  }
}

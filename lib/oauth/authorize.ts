import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isClientId,
  isCodeChallenge,
  isState,
  parseScopes,
  redirectUriMatches,
  redirectWith,
  scopesWithin,
  type OAuthErrorCode,
  type OAuthScope,
} from "./protocol";
import { getAppByClientId, type OAuthApp } from "./store";

export type AuthorizeParams = {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
};

export type AuthorizeRequest = {
  app: OAuthApp;
  redirectUri: string;
  scopes: OAuthScope[];
  state: string | undefined;
  codeChallenge: string;
};

export type AuthorizeCheck =
  /** The app or the address cannot be trusted, so the person is told here and sent nowhere. */
  | { kind: "stop"; message: string }
  /** The app and address are good but the request is not: the app is told, at its address. */
  | { kind: "redirect"; url: string }
  | { kind: "ok"; request: AuthorizeRequest };

/** The address that tells the app its request failed (RFC 6749 §4.1.2.1). */
export function errorRedirect(
  redirectUri: string,
  state: string | undefined,
  error: OAuthErrorCode,
  description: string,
): string {
  return redirectWith(redirectUri, { error, error_description: description, state });
}

/**
 * Checks an authorization request, in the order that matters: first who is asking and where the
 * answer would go, and only then everything else. Until the app and its address are known to
 * match, nothing is sent to that address, because it might be someone else's.
 */
export async function checkAuthorizeRequest(db: SupabaseClient, params: AuthorizeParams): Promise<AuthorizeCheck> {
  if (!isClientId(params.client_id)) {
    return { kind: "stop", message: "This link is missing a valid client_id." };
  }
  const app = await getAppByClientId(db, params.client_id);
  if (!app) {
    return { kind: "stop", message: "This app is not registered with Cencori, or has been deleted." };
  }
  if (!redirectUriMatches(params.redirect_uri, app.redirect_uris)) {
    return {
      kind: "stop",
      message: "The redirect_uri in this link is not one this app registered with Cencori.",
    };
  }
  const redirectUri = params.redirect_uri;
  const state = isState(params.state) ? params.state : undefined;
  const fail = (error: OAuthErrorCode, description: string): AuthorizeCheck => ({
    kind: "redirect",
    url: errorRedirect(redirectUri, state, error, description),
  });

  if (params.state !== undefined && state === undefined) {
    return fail("invalid_request", "state must be 1 to 512 printable characters.");
  }
  if (params.response_type !== "code") {
    return fail("unsupported_response_type", "response_type must be code.");
  }
  if ((params.code_challenge_method ?? "S256") !== "S256" || !isCodeChallenge(params.code_challenge)) {
    return fail("invalid_request", "A PKCE code_challenge with code_challenge_method=S256 is required.");
  }
  const scopes = parseScopes(params.scope);
  if (!scopes) {
    return fail("invalid_scope", "scope is missing or names a permission that does not exist.");
  }
  if (!scopesWithin(scopes, app.scopes)) {
    return fail("invalid_scope", "scope asks for a permission this app did not register.");
  }
  return { kind: "ok", request: { app, redirectUri, scopes, state, codeChallenge: params.code_challenge } };
}

/** The consent screen's own address for a request, to come back to after signing in. */
export function authorizePath(params: AuthorizeParams): string {
  const query = new URLSearchParams();
  for (const key of [
    "response_type",
    "client_id",
    "redirect_uri",
    "scope",
    "state",
    "code_challenge",
    "code_challenge_method",
  ] as const) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  return `/oauth/authorize?${query.toString()}`;
}

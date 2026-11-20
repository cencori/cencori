import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Cencori OAuth: the rules of the protocol, with nothing that touches the database.
 *
 * Another product asks a person for access to one of their Cencori organizations. The person
 * sees what is asked for, picks the organization, and the product gets a token limited to that
 * organization and those permissions. This is OAuth 2.1's authorization code flow: PKCE (S256)
 * is required of every app, redirect addresses must match exactly, and refresh tokens are
 * replaced each time they are used.
 */

/** A code is exchanged within seconds; five minutes covers a slow redirect. */
export const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
/** Short, because an access token cannot be withdrawn from a copy someone already holds. */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
/** A refresh token left unused this long ends the grant: the person authorizes again. */
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export const CLIENT_ID_PREFIX = "coa_";
export const CLIENT_SECRET_PREFIX = "cos_";
export const ACCESS_TOKEN_PREFIX = "cat_";
export const REFRESH_TOKEN_PREFIX = "crt_";

const CLIENT_ID_PATTERN = /^coa_[a-f0-9]{24}$/;
const CLIENT_SECRET_PATTERN = /^cos_[a-f0-9]{48}$/;
const ACCESS_TOKEN_PATTERN = /^cat_[a-f0-9]{48}$/;
const REFRESH_TOKEN_PATTERN = /^crt_[a-f0-9]{48}$/;
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
// RFC 7636: the challenge is a SHA-256 digest in base64url (43 characters), the verifier is
// 43 to 128 unreserved characters.
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
/** Whatever the app sends, handed back unchanged. Printable ASCII, so it is safe in a URL. */
const STATE_PATTERN = /^[\x20-\x7E]{1,512}$/;

export const MAX_REDIRECT_URIS = 10;
const MAX_REDIRECT_URI_LENGTH = 500;

// --- Permissions ---------------------------------------------------------------------------

// The permissions are in their own file, which has nothing Node-only in it, so the consent
// screen and the settings page can use them in the browser.
export * from "./scopes";

// --- Shapes of the values ------------------------------------------------------------------

export function isClientId(value: unknown): value is string {
  return typeof value === "string" && CLIENT_ID_PATTERN.test(value);
}

export function isClientSecret(value: unknown): value is string {
  return typeof value === "string" && CLIENT_SECRET_PATTERN.test(value);
}

export function isAccessToken(value: unknown): value is string {
  return typeof value === "string" && ACCESS_TOKEN_PATTERN.test(value);
}

export function isRefreshToken(value: unknown): value is string {
  return typeof value === "string" && REFRESH_TOKEN_PATTERN.test(value);
}

export function isAuthCode(value: unknown): value is string {
  return typeof value === "string" && CODE_PATTERN.test(value);
}

export function isCodeChallenge(value: unknown): value is string {
  return typeof value === "string" && CHALLENGE_PATTERN.test(value);
}

export function isCodeVerifier(value: unknown): value is string {
  return typeof value === "string" && VERIFIER_PATTERN.test(value);
}

export function isState(value: unknown): value is string {
  return typeof value === "string" && STATE_PATTERN.test(value);
}

// --- Redirect addresses --------------------------------------------------------------------

/**
 * Whether an address may be registered as somewhere a code is sent.
 *
 * https anywhere. http only for this computer (localhost, 127.0.0.1, [::1]), which is how an
 * app under development and a desktop app listen for the answer. No wildcards, no fragment, no
 * sign-in details in the address: whoever receives a code there can try to exchange it.
 */
export function isRegistrableRedirectUri(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_REDIRECT_URI_LENGTH) {
    return false;
  }
  if (value.includes("*") || /\s/.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash || value.includes("#")) return false;
  if (url.protocol === "https:") return url.hostname.length > 0;
  if (url.protocol === "http:") return isLoopbackHost(url.hostname);
  return false;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * Whether the address an app sent is one it registered. Compared as text, character for
 * character: no prefix matching and no normalising, so nothing close to a registered address
 * passes for it.
 */
export function redirectUriMatches(sent: unknown, registered: readonly string[]): sent is string {
  return typeof sent === "string" && registered.includes(sent);
}

/** The address to send the browser back to, carrying the answer in the query string. */
export function redirectWith(redirectUri: string, params: Record<string, string | undefined>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

// --- Secrets -------------------------------------------------------------------------------

export function newClientId(): string {
  return `${CLIENT_ID_PREFIX}${randomBytes(12).toString("hex")}`;
}

export function newClientSecret(): string {
  return `${CLIENT_SECRET_PREFIX}${randomBytes(24).toString("hex")}`;
}

export function newAccessToken(): string {
  return `${ACCESS_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
}

export function newRefreshToken(): string {
  return `${REFRESH_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
}

export function newAuthCode(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * How a secret is kept: only its SHA-256. These are long random values, not passwords, so a
 * plain digest is enough and lets a token be found by one indexed lookup.
 */
export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** The PKCE challenge for a verifier (S256). */
export function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function sameValue(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

// --- Errors --------------------------------------------------------------------------------

/** RFC 6749 §5.2, plus invalid_token from RFC 6750 for the API. */
export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "invalid_scope"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "unsupported_response_type"
  | "access_denied"
  | "server_error"
  | "invalid_token"
  | "insufficient_scope";

export function noStoreHeaders(): Record<string, string> {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" };
}

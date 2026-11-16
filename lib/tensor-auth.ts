import { createHash, timingSafeEqual } from "crypto";

export const TENSOR_CALLBACK_URL = "tensor://auth/callback";
export const TENSOR_AUTH_CODE_TTL_MS = 5 * 60 * 1000;
/** Pre-rename desktop scheme. Accepted so older installs can still sign in. */
const LEGACY_CALLBACK_URL = "basecode://auth/callback";
/**
 * The Tensor website's account pages (tensorade.app/dashboard, /billing, /settings). Listed
 * exactly: whoever receives a code here can exchange it, so only hosts we serve may be named.
 * Local development of the site signs in through the loopback rule below (127.0.0.1).
 */
export const TENSOR_WEB_CALLBACK_URL = "https://tensorade.app/auth/callback";
/** The same page on www, which is the host Vercel serves the site from. */
export const TENSOR_WEB_WWW_CALLBACK_URL = "https://www.tensorade.app/auth/callback";
/**
 * The Tensor phone app (tensor-mobile, Expo). Its own scheme, not tensor://: with no redirect_uri
 * the desktop's tensor:// is the default, and the desktop app would answer it too. In Expo Go it
 * comes back on exp:// instead, allowed only for private network hosts (isExpoGoCallback).
 */
export const TENSOR_MOBILE_CALLBACK_URL = "tensor-mobile://auth/callback";

const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const STATE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export function isTensorCode(value: unknown): value is string {
  return typeof value === "string" && CODE_PATTERN.test(value);
}

export function isTensorChallenge(value: unknown): value is string {
  return typeof value === "string" && CHALLENGE_PATTERN.test(value);
}

export function isTensorState(value: unknown): value is string {
  return typeof value === "string" && STATE_PATTERN.test(value);
}

export function isTensorRedirectUri(value: unknown): value is string {
  if (
    value === TENSOR_CALLBACK_URL ||
    value === LEGACY_CALLBACK_URL ||
    value === TENSOR_WEB_CALLBACK_URL ||
    value === TENSOR_WEB_WWW_CALLBACK_URL ||
    value === TENSOR_MOBILE_CALLBACK_URL
  ) {
    return true;
  }
  if (typeof value !== "string" || value.length > 200) return false;
  if (isExpoGoCallback(value)) return true;

  try {
    const url = new URL(value);
    const port = Number(url.port);
    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      Number.isInteger(port) &&
      port >= 1024 &&
      port <= 65535 &&
      url.pathname === "/auth/callback" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

/**
 * The Tensor phone app while it is being developed in Expo Go, which can only come back on
 * exp://<the computer's address>:<port>/--/auth/callback. Only private network addresses are
 * allowed (a computer on the same network as the phone, or this one), as the desktop's dev builds
 * use 127.0.0.1: an exp:// link to any other host could hand a code to someone else's server.
 */
function isExpoGoCallback(value: string): boolean {
  if (!value.startsWith("exp://")) return false;
  try {
    const url = new URL(value);
    const port = Number(url.port);
    return (
      isPrivateIPv4(url.hostname) &&
      Number.isInteger(port) &&
      port >= 1024 &&
      port <= 65535 &&
      url.pathname === "/--/auth/callback" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

export function isTensorVerifier(value: unknown): value is string {
  return typeof value === "string" && VERIFIER_PATTERN.test(value);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function sameValue(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function tensorSignInPath(
  challenge: string,
  state: string,
  redirectUri?: string,
): string {
  const params = new URLSearchParams({ code_challenge: challenge, state });
  if (redirectUri && redirectUri !== TENSOR_CALLBACK_URL) {
    params.set("redirect_uri", redirectUri);
  }
  return `/tensor/sign-in?${params.toString()}`;
}

export function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
  };
}

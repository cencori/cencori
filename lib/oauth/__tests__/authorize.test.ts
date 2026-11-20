import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizePath, checkAuthorizeRequest, type AuthorizeParams } from "../authorize";
import { roleMayGrant } from "../store";

const CLIENT_ID = "coa_0123456789abcdef01234567";
const REDIRECT = "https://app.example.com/oauth/callback";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

/** A database that knows one app, which is all checkAuthorizeRequest reads. */
function dbWith(app: Record<string, unknown> | null): SupabaseClient {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: app, error: null }),
  };
  return { from: () => query } as unknown as SupabaseClient;
}

const app = {
  id: "app-1",
  organization_id: "org-1",
  name: "Acme Deploy",
  client_id: CLIENT_ID,
  redirect_uris: [REDIRECT],
  scopes: ["organization:read", "projects:read", "projects:write"],
  verified: false,
};

const good: AuthorizeParams = {
  response_type: "code",
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT,
  scope: "projects:write organization:read",
  state: "abc123",
  code_challenge: CHALLENGE,
  code_challenge_method: "S256",
};

describe("checkAuthorizeRequest", () => {
  it("accepts a complete request and orders its scopes", async () => {
    const check = await checkAuthorizeRequest(dbWith(app), good);
    expect(check.kind).toBe("ok");
    if (check.kind !== "ok") return;
    expect(check.request.scopes).toEqual(["organization:read", "projects:write"]);
    expect(check.request.redirectUri).toBe(REDIRECT);
    expect(check.request.state).toBe("abc123");
  });

  it("stops, sending nothing anywhere, when the app is unknown", async () => {
    expect((await checkAuthorizeRequest(dbWith(null), good)).kind).toBe("stop");
    expect((await checkAuthorizeRequest(dbWith(app), { ...good, client_id: "nope" })).kind).toBe("stop");
  });

  it("stops when the address is not one the app registered, however close", async () => {
    for (const redirect_uri of [
      "https://evil.example/oauth/callback",
      `${REDIRECT}/`,
      `${REDIRECT}?next=https://evil.example`,
      "https://app.example.com.evil.example/oauth/callback",
      undefined,
    ]) {
      const check = await checkAuthorizeRequest(dbWith(app), { ...good, redirect_uri });
      expect(check.kind).toBe("stop");
    }
  });

  it("tells the app, at its own address, about every other problem", async () => {
    const cases: Array<[Partial<AuthorizeParams>, string]> = [
      [{ response_type: "token" }, "unsupported_response_type"],
      [{ code_challenge: undefined }, "invalid_request"],
      [{ code_challenge: "too-short" }, "invalid_request"],
      [{ code_challenge_method: "plain" }, "invalid_request"],
      [{ scope: undefined }, "invalid_scope"],
      [{ scope: "projects:read billing:write" }, "invalid_scope"],
      [{ scope: "api_keys:write" }, "invalid_scope"],
      [{ state: "bad\nstate" }, "invalid_request"],
    ];
    for (const [change, error] of cases) {
      const check = await checkAuthorizeRequest(dbWith(app), { ...good, ...change });
      expect(check.kind).toBe("redirect");
      if (check.kind !== "redirect") continue;
      const url = new URL(check.url);
      expect(`${url.origin}${url.pathname}`).toBe(REDIRECT);
      expect(url.searchParams.get("error")).toBe(error);
      expect(url.searchParams.has("code")).toBe(false);
    }
  });

  it("returns the state with an error, and leaves a malformed one out", async () => {
    const withState = await checkAuthorizeRequest(dbWith(app), { ...good, scope: "nope" });
    expect(withState.kind === "redirect" && new URL(withState.url).searchParams.get("state")).toBe("abc123");
    const badState = await checkAuthorizeRequest(dbWith(app), { ...good, state: "bad\nstate" });
    expect(badState.kind === "redirect" && new URL(badState.url).searchParams.has("state")).toBe(false);
  });

  it("works without a state", async () => {
    const check = await checkAuthorizeRequest(dbWith(app), { ...good, state: undefined });
    expect(check.kind === "ok" && check.request.state).toBe(undefined);
  });
});

describe("authorizePath", () => {
  it("rebuilds the consent screen's address from a request, and only from its own parameters", () => {
    const path = authorizePath({ ...good, ...({ code: "stolen", next: "/admin" } as object) });
    const url = new URL(path, "https://cencori.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(url.searchParams.has("code")).toBe(false);
    expect(url.searchParams.has("next")).toBe(false);
  });
});

describe("roleMayGrant", () => {
  it("lets an owner give anything, an admin anything but key creation, and a member nothing", () => {
    expect(roleMayGrant("owner", ["api_keys:write", "projects:write"])).toBe(true);
    expect(roleMayGrant("admin", ["projects:write", "api_keys:read", "usage:read"])).toBe(true);
    expect(roleMayGrant("admin", ["api_keys:write"])).toBe(false);
    expect(roleMayGrant("member", ["organization:read"])).toBe(false);
    expect(roleMayGrant(null, ["organization:read"])).toBe(false);
  });
});

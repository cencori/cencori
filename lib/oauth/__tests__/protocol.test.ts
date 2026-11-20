import { describe, expect, it } from "vitest";
import {
  challengeFor,
  describeScopes,
  formatScopes,
  hashSecret,
  isAccessToken,
  isAuthCode,
  isClientId,
  isClientSecret,
  isCodeChallenge,
  isCodeVerifier,
  isRefreshToken,
  isRegistrableRedirectUri,
  isState,
  newAccessToken,
  newAuthCode,
  newClientId,
  newClientSecret,
  newRefreshToken,
  parseScopes,
  redirectUriMatches,
  redirectWith,
  sameValue,
  scopeAllows,
  scopesWithin,
} from "../protocol";

describe("scopes", () => {
  it("puts what was asked for in the canonical order, once each", () => {
    expect(parseScopes("usage:read projects:write  projects:write organization:read")).toEqual([
      "organization:read",
      "projects:write",
      "usage:read",
    ]);
  });

  it("refuses a request that names anything unknown", () => {
    expect(parseScopes("projects:read billing:write")).toBeNull();
    expect(parseScopes("")).toBeNull();
    expect(parseScopes(undefined)).toBeNull();
    expect(parseScopes("organization:write")).toBeNull();
  });

  it("lets write stand in for read, and nothing else", () => {
    expect(scopeAllows(["projects:write"], "projects:read")).toBe(true);
    expect(scopeAllows(["projects:write"], "projects:write")).toBe(true);
    expect(scopeAllows(["projects:read"], "projects:write")).toBe(false);
    expect(scopeAllows(["projects:write"], "api_keys:read")).toBe(false);
    expect(scopeAllows([], "usage:read")).toBe(false);
  });

  it("checks a request against what the app registered", () => {
    expect(scopesWithin(["projects:read"], ["projects:read", "usage:read"])).toBe(true);
    expect(scopesWithin(["projects:write"], ["projects:read"])).toBe(false);
  });

  it("shows one row for each kind of thing, at its highest level", () => {
    const rows = describeScopes(["projects:read", "projects:write", "usage:read"]);
    expect(rows.map((row) => [row.resource, row.level])).toEqual([
      ["projects", "write"],
      ["usage", "read"],
    ]);
    expect(rows.every((row) => row.description.length > 0)).toBe(true);
  });

  it("writes scopes back in the canonical order", () => {
    expect(formatScopes(["usage:read", "organization:read"])).toBe("organization:read usage:read");
  });
});

describe("redirect addresses", () => {
  it("accepts https anywhere and http on this computer", () => {
    expect(isRegistrableRedirectUri("https://app.example.com/oauth/callback")).toBe(true);
    expect(isRegistrableRedirectUri("https://app.example.com/cb?tenant=1")).toBe(true);
    expect(isRegistrableRedirectUri("http://localhost:3000/callback")).toBe(true);
    expect(isRegistrableRedirectUri("http://127.0.0.1:8976/callback")).toBe(true);
    expect(isRegistrableRedirectUri("http://[::1]:8976/callback")).toBe(true);
  });

  it("refuses plain http elsewhere, other schemes, wildcards, fragments and sign-in details", () => {
    expect(isRegistrableRedirectUri("http://app.example.com/callback")).toBe(false);
    expect(isRegistrableRedirectUri("http://localhost.example.com/callback")).toBe(false);
    expect(isRegistrableRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isRegistrableRedirectUri("myapp://callback")).toBe(false);
    expect(isRegistrableRedirectUri("https://*.example.com/callback")).toBe(false);
    expect(isRegistrableRedirectUri("https://app.example.com/callback#token")).toBe(false);
    expect(isRegistrableRedirectUri("https://app.example.com/callback#")).toBe(false);
    expect(isRegistrableRedirectUri("https://user:pass@app.example.com/callback")).toBe(false);
    expect(isRegistrableRedirectUri("https://app.example.com/call back")).toBe(false);
    expect(isRegistrableRedirectUri("not a url")).toBe(false);
    expect(isRegistrableRedirectUri(`https://app.example.com/${"a".repeat(500)}`)).toBe(false);
    expect(isRegistrableRedirectUri(undefined)).toBe(false);
  });

  it("matches a sent address only when it is exactly a registered one", () => {
    const registered = ["https://app.example.com/oauth/callback"];
    expect(redirectUriMatches("https://app.example.com/oauth/callback", registered)).toBe(true);
    expect(redirectUriMatches("https://app.example.com/oauth/callback/", registered)).toBe(false);
    expect(redirectUriMatches("https://app.example.com/oauth/callback?x=1", registered)).toBe(false);
    expect(redirectUriMatches("https://app.example.com.evil.test/oauth/callback", registered)).toBe(false);
    expect(redirectUriMatches("HTTPS://app.example.com/oauth/callback", registered)).toBe(false);
    expect(redirectUriMatches(undefined, registered)).toBe(false);
  });

  it("adds the answer to the query string and keeps what was already there", () => {
    const url = new URL(
      redirectWith("https://app.example.com/cb?tenant=1", { code: "abc", state: "x y", error: undefined }),
    );
    expect(url.searchParams.get("tenant")).toBe("1");
    expect(url.searchParams.get("code")).toBe("abc");
    expect(url.searchParams.get("state")).toBe("x y");
    expect(url.searchParams.has("error")).toBe(false);
  });
});

describe("secrets", () => {
  it("makes values of the shape it accepts, different each time", () => {
    expect(isClientId(newClientId())).toBe(true);
    expect(isClientSecret(newClientSecret())).toBe(true);
    expect(isAccessToken(newAccessToken())).toBe(true);
    expect(isRefreshToken(newRefreshToken())).toBe(true);
    expect(isAuthCode(newAuthCode())).toBe(true);
    expect(newAccessToken()).not.toBe(newAccessToken());
  });

  it("does not take one kind of secret for another", () => {
    expect(isAccessToken(newRefreshToken())).toBe(false);
    expect(isRefreshToken(newAccessToken())).toBe(false);
    expect(isClientSecret(newClientId())).toBe(false);
    expect(isClientId("coa_xyz")).toBe(false);
  });

  it("derives the PKCE challenge the way RFC 7636 does", () => {
    // The worked example in RFC 7636, appendix B.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(challengeFor(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    expect(isCodeVerifier(verifier)).toBe(true);
    expect(isCodeChallenge(challengeFor(verifier))).toBe(true);
    expect(isCodeVerifier("short")).toBe(false);
  });

  it("hashes to the same value each time and compares without leaking length", () => {
    expect(hashSecret("abc")).toBe(hashSecret("abc"));
    expect(hashSecret("abc")).toHaveLength(64);
    expect(sameValue("abc", "abc")).toBe(true);
    expect(sameValue("abc", "abd")).toBe(false);
    expect(sameValue("abc", "abcd")).toBe(false);
  });

  it("accepts a printable state and refuses control characters or an empty one", () => {
    expect(isState("xyz-123_ABC.~")).toBe(true);
    expect(isState("")).toBe(false);
    expect(isState("line\nbreak")).toBe(false);
    expect(isState("a".repeat(513))).toBe(false);
  });
});

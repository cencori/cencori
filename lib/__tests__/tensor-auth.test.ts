import { randomBytes } from "crypto";
import { describe, expect, test } from "vitest";
import {
  TENSOR_CALLBACK_URL,
  tensorSignInPath,
  isTensorChallenge,
  isTensorCode,
  isTensorRedirectUri,
  isTensorState,
  isTensorVerifier,
  sameValue,
  sha256,
} from "@/lib/tensor-auth";

describe("Tensor desktop authentication contract", () => {
  test("accepts the generated PKCE verifier, challenge, state, and one-time code", () => {
    const verifier = randomBytes(64).toString("base64url");
    const challenge = sha256(verifier);
    const state = randomBytes(32).toString("base64url");
    const code = randomBytes(32).toString("base64url");

    expect(isTensorVerifier(verifier)).toBe(true);
    expect(isTensorChallenge(challenge)).toBe(true);
    expect(isTensorState(state)).toBe(true);
    expect(isTensorCode(code)).toBe(true);
    expect(sameValue(sha256(verifier), challenge)).toBe(true);
  });

  test("rejects malformed and undersized credentials", () => {
    expect(isTensorVerifier("short")).toBe(false);
    expect(isTensorChallenge("not+a+base64url+challenge".padEnd(43, "x"))).toBe(false);
    expect(isTensorState("../../callback")).toBe(false);
    expect(isTensorCode("A".repeat(44))).toBe(false);
    expect(sameValue("expected", "different")).toBe(false);
  });

  test("builds a relative, encoded Cencori return path", () => {
    const challenge = "A".repeat(43);
    const state = "B".repeat(43);
    const path = tensorSignInPath(challenge, state);

    expect(path).toBe(
      `/tensor/sign-in?code_challenge=${challenge}&state=${state}`,
    );
  });

  test("accepts only the packaged callback or an exact loopback callback", () => {
    expect(isTensorRedirectUri(TENSOR_CALLBACK_URL)).toBe(true);
    expect(isTensorRedirectUri("http://127.0.0.1:49152/auth/callback")).toBe(true);

    for (const value of [
      "http://localhost:49152/auth/callback",
      "http://127.0.0.1:80/auth/callback",
      "http://127.0.0.1:49152/other",
      "http://127.0.0.1:49152/auth/callback?next=https://example.com",
      "https://127.0.0.1:49152/auth/callback",
      "https://example.com/auth/callback",
    ]) {
      expect(isTensorRedirectUri(value)).toBe(false);
    }
  });

  test("preserves a validated loopback callback through sign in", () => {
    const redirectUri = "http://127.0.0.1:49152/auth/callback";
    const path = tensorSignInPath("C".repeat(43), "D".repeat(43), redirectUri);

    expect(new URL(path, "https://cencori.com").searchParams.get("redirect_uri")).toBe(
      redirectUri,
    );
  });
});

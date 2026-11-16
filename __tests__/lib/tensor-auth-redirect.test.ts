import { describe, expect, it } from "vitest";
import { isTensorRedirectUri } from "@/lib/tensor-auth";

describe("where a Tensor sign-in may send its code", () => {
  it("allows the desktop, the website and the phone app", () => {
    expect(isTensorRedirectUri("tensor://auth/callback")).toBe(true);
    expect(isTensorRedirectUri("https://tensorade.app/auth/callback")).toBe(true);
    expect(isTensorRedirectUri("tensor-mobile://auth/callback")).toBe(true);
    expect(isTensorRedirectUri("http://127.0.0.1:43123/auth/callback")).toBe(true);
  });

  it("allows Expo Go only on a private network address", () => {
    expect(isTensorRedirectUri("exp://192.168.1.4:8081/--/auth/callback")).toBe(true);
    expect(isTensorRedirectUri("exp://10.0.0.12:8081/--/auth/callback")).toBe(true);
    expect(isTensorRedirectUri("exp://172.20.1.3:8081/--/auth/callback")).toBe(true);
    expect(isTensorRedirectUri("exp://8.8.8.8:8081/--/auth/callback")).toBe(false);
    expect(isTensorRedirectUri("exp://evil.example:8081/--/auth/callback")).toBe(false);
    expect(isTensorRedirectUri("exp://u-abc.exp.direct/--/auth/callback")).toBe(false);
    expect(isTensorRedirectUri("exp://192.168.1.4:8081/--/auth/callback?code=x")).toBe(false);
    expect(isTensorRedirectUri("exp://192.168.1.4:8081/--/other")).toBe(false);
    expect(isTensorRedirectUri("exp://172.32.0.1:8081/--/auth/callback")).toBe(false);
  });

  it("refuses anything else, including look-alikes", () => {
    expect(isTensorRedirectUri("tensor-mobile://auth/callback?x=1")).toBe(false);
    expect(isTensorRedirectUri("tensor-mobile://evil/callback")).toBe(false);
    expect(isTensorRedirectUri("https://evil.example/auth/callback")).toBe(false);
  });
});

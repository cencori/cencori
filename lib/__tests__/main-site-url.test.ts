import { describe, expect, it } from "vitest";
import { getMainSiteUrl } from "@/lib/main-site-url";

describe("getMainSiteUrl", () => {
  it("moves production console links to the public site", () => {
    expect(getMainSiteUrl("/docs", "https://console.cencori.com")).toBe("https://cencori.com/docs");
  });

  it("moves local console links to localhost and preserves the port", () => {
    expect(getMainSiteUrl("/docs", "http://console.localhost:3000")).toBe("http://localhost:3000/docs");
  });

  it("keeps deep documentation paths on the public origin", () => {
    expect(getMainSiteUrl("docs/security", "https://console.cencori.com/settings")).toBe("https://cencori.com/docs/security");
  });
});

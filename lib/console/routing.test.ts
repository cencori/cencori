import { describe, expect, it } from "vitest";
import {
  buildScopedConsolePath,
  getCanonicalConsoleRedirect,
  getConsoleOriginForHostname,
  getConsoleRoute,
  isConsoleHostname,
} from "./routing";

describe("console routing", () => {
  it("recognizes production and development console hosts", () => {
    expect(isConsoleHostname("console.cencori.com")).toBe(true);
    expect(isConsoleHostname("console.localhost:3000")).toBe(true);
    expect(isConsoleHostname("cencori.com")).toBe(false);
  });

  it("resolves the console counterpart only for main-app hosts", () => {
    expect(getConsoleOriginForHostname("cencori.com")).toBe("https://console.cencori.com");
    expect(getConsoleOriginForHostname("www.cencori.com")).toBe("https://console.cencori.com");
    expect(getConsoleOriginForHostname("localhost:3000")).toBe("http://console.localhost:3000");
    expect(getConsoleOriginForHostname("console.cencori.com")).toBeNull();
    expect(getConsoleOriginForHostname("console.localhost:3000")).toBeNull();
    expect(getConsoleOriginForHostname("scan.cencori.com")).toBeNull();
    expect(getConsoleOriginForHostname("my-preview.vercel.app")).toBeNull();
  });

  it("classifies project routes without exposing tenant slugs", () => {
    expect(getConsoleRoute("/home")).toMatchObject({ scope: "project", scopedPath: "" });
    expect(getConsoleRoute("/logs/")).toMatchObject({ scope: "project", scopedPath: "/logs" });
    expect(getConsoleRoute("/ai-gateway/providers")).toMatchObject({
      scope: "project",
      scopedPath: "/ai-gateway/providers",
    });
    expect(getConsoleRoute("/api-keys")).toBeNull();
    expect(getConsoleRoute("/agents")).toMatchObject({
      scope: "project",
      scopedPath: "/agents",
    });
    expect(getConsoleRoute("/embedded-agents")).toMatchObject({
      canonicalPath: "/agents",
      scope: "project",
      scopedPath: "/agents",
    });
  });

  it("keeps organization routes distinct from project routes", () => {
    expect(getConsoleRoute("/billing")).toMatchObject({
      scope: "organization",
      scopedPath: "/billing",
    });
    expect(getConsoleRoute("/organization/logs")).toMatchObject({
      scope: "organization",
      scopedPath: "/logs",
    });
    expect(getConsoleRoute("/organization/settings")).toMatchObject({
      scope: "organization",
      scopedPath: "/settings",
    });
  });

  it("builds the existing scoped route used by the application internally", () => {
    const projectRoute = getConsoleRoute("/logs");
    const organizationRoute = getConsoleRoute("/billing");

    expect(projectRoute && buildScopedConsolePath(projectRoute, "acme", "api"))
      .toBe("/acme/api/logs");
    expect(organizationRoute && buildScopedConsolePath(organizationRoute, "acme", "api"))
      .toBe("/acme/~/billing");
  });

  it("canonicalizes existing console bookmarks without breaking their scope", () => {
    expect(getCanonicalConsoleRedirect("/acme/api")).toEqual({
      canonicalPath: "/home",
      organizationSlug: "acme",
      projectSlug: "api",
    });
    expect(getCanonicalConsoleRedirect("/acme/api/logs")).toEqual({
      canonicalPath: "/logs",
      organizationSlug: "acme",
      projectSlug: "api",
    });
    expect(getCanonicalConsoleRedirect("/acme/~/billing")).toEqual({
      canonicalPath: "/billing",
      organizationSlug: "acme",
      projectSlug: null,
    });
    expect(getCanonicalConsoleRedirect("/acme/api/api-keys")).toMatchObject({
      canonicalPath: "/settings",
      settingsTab: "api",
    });
    expect(getCanonicalConsoleRedirect("/acme/api/agents")).toEqual({
      canonicalPath: "/agents",
      organizationSlug: "acme",
      projectSlug: "api",
    });
    expect(getCanonicalConsoleRedirect("/acme/api/embedded-agents")).toEqual({
      canonicalPath: "/agents",
      organizationSlug: "acme",
      projectSlug: "api",
    });
  });
});

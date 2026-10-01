import { describe, expect, test } from "vitest";
import { swapWorkspaceInPath } from "@/lib/workspace-switch";

describe("swapWorkspaceInPath", () => {
  test("preserves the subpath across orgs", () => {
    expect(swapWorkspaceInPath("/acme/api/logs", "neworg", "web")).toBe("/neworg/web/logs");
    expect(swapWorkspaceInPath("/acme/api/ai-gateway/providers", "neworg", "web")).toBe(
      "/neworg/web/ai-gateway/providers",
    );
  });

  test("maps bare overviews to the new workspace overview", () => {
    expect(swapWorkspaceInPath("/acme", "neworg", "web")).toBe("/neworg/web");
    expect(swapWorkspaceInPath("/acme/api", "neworg", "web")).toBe("/neworg/web");
  });

  test("keeps org-scoped routes org-scoped", () => {
    expect(swapWorkspaceInPath("/acme/~/billing", "neworg", "web")).toBe("/neworg/~/billing");
    expect(swapWorkspaceInPath("/acme/~/projects", "neworg", null)).toBe("/neworg/~/projects");
  });

  test("falls back to the project list without a target project", () => {
    expect(swapWorkspaceInPath("/acme/api/logs", "neworg", null)).toBe("/neworg/~/projects");
    expect(swapWorkspaceInPath("/acme", "neworg", null)).toBe("/neworg/~/projects");
  });

  test("returns null for non-workspace paths", () => {
    expect(swapWorkspaceInPath("/", "neworg", "web")).toBeNull();
    expect(swapWorkspaceInPath("/dashboard", "neworg", "web")).toBeNull();
    expect(swapWorkspaceInPath("/docs/security", "neworg", "web")).toBeNull();
  });
});

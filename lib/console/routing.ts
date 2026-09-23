import { isReservedSlug } from "@/lib/reserved-slugs";

export const CONSOLE_INTERNAL_PREFIX = "/console-app";

export const ACTIVE_ORG_COOKIE = "cencori:active-org";
export const ACTIVE_PROJECT_COOKIE = "cencori:active-project";

export type ConsoleScope = "project" | "organization";

export interface ConsoleRoute {
  canonicalPath: string;
  scope: ConsoleScope;
  /** The path appended after /{org}/{project} or /{org}/~. */
  scopedPath: string;
}

export interface ScopedConsoleRedirect {
  canonicalPath: string;
  organizationSlug: string;
  projectSlug: string | null;
  settingsTab?: "api";
}

const PROJECT_ROOTS = new Set([
  "observability",
  "logs",
  "ai-gateway",
  "security",
  "memory",
  "deployments",
  "monetization",
  "agents",
  "webhooks",
  "settings",
]);

const ORGANIZATION_ROOTS = new Set([
  "projects",
  "billing",
  "usage",
  "teams",
  "audit-log",
  "governance",
]);

const ORGANIZATION_PRODUCT_ROOTS = new Set([
  "observability",
  "logs",
  "ai-gateway",
  "security",
  "deployments",
  "monetization",
  "providers",
  "webhooks",
  "settings",
]);

function normalizePathname(pathname: string): string {
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

export function isConsoleHostname(hostname: string): boolean {
  const normalized = hostname.split(":")[0].toLowerCase();
  return normalized === "console.cencori.com" || normalized === "console.localhost";
}

/**
 * Resolve the public console URL to its product scope.
 *
 * Project pages stay intentionally short because the selected project lives
 * in console context: /home, /logs, /ai-gateway/providers. Organization-wide
 * products that would otherwise collide use /organization/*.
 */
export function getConsoleRoute(pathname: string): ConsoleRoute | null {
  const canonicalPath = normalizePathname(pathname);

  if (canonicalPath === "/embedded-agents") {
    return { canonicalPath: "/agents", scope: "project", scopedPath: "/agents" };
  }

  const segments = canonicalPath.split("/").filter(Boolean);

  if (segments.length === 1 && segments[0] === "home") {
    return { canonicalPath, scope: "project", scopedPath: "" };
  }

  const [root] = segments;
  if (root && PROJECT_ROOTS.has(root)) {
    return { canonicalPath, scope: "project", scopedPath: canonicalPath };
  }

  if (root && ORGANIZATION_ROOTS.has(root)) {
    return { canonicalPath, scope: "organization", scopedPath: canonicalPath };
  }

  if (
    root === "organization" &&
    segments[1] &&
    ORGANIZATION_PRODUCT_ROOTS.has(segments[1])
  ) {
    return {
      canonicalPath,
      scope: "organization",
      scopedPath: `/${segments.slice(1).join("/")}`,
    };
  }

  return null;
}

/** Kept as a boolean-friendly compatibility helper for client shells. */
export function getConsoleSurface(pathname: string): string | null {
  return getConsoleRoute(pathname)?.canonicalPath ?? null;
}

export function buildScopedConsolePath(
  route: ConsoleRoute,
  organizationSlug: string,
  projectSlug?: string | null,
): string | null {
  if (route.scope === "project") {
    if (!projectSlug) return null;
    return `/${organizationSlug}/${projectSlug}${route.scopedPath}`;
  }

  return `/${organizationSlug}/~${route.scopedPath}`;
}

/**
 * Convert the former /{org}/{project}/... console URLs to their flat public
 * equivalents. This is only applied on the console host; the old application
 * routes remain intact everywhere else.
 */
export function getCanonicalConsoleRedirect(pathname: string): ScopedConsoleRedirect | null {
  const normalized = normalizePathname(pathname);
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const [organizationSlug, scopeOrProject, ...rest] = segments;
  if (!organizationSlug || !scopeOrProject) return null;
  if (isReservedSlug(organizationSlug)) return null;

  if (scopeOrProject === "~") {
    const [root] = rest;
    if (!root) return null;

    if (ORGANIZATION_ROOTS.has(root)) {
      return {
        canonicalPath: `/${rest.join("/")}`,
        organizationSlug,
        projectSlug: null,
      };
    }

    if (ORGANIZATION_PRODUCT_ROOTS.has(root)) {
      return {
        canonicalPath: `/organization/${rest.join("/")}`,
        organizationSlug,
        projectSlug: null,
      };
    }

    return null;
  }

  const projectSlug = scopeOrProject;
  if (rest.length === 0) {
    return { canonicalPath: "/home", organizationSlug, projectSlug };
  }

  if (rest.length === 1 && rest[0] === "api-keys") {
    return {
      canonicalPath: "/settings",
      organizationSlug,
      projectSlug,
      settingsTab: "api",
    };
  }

  if (rest.length === 1 && rest[0] === "embedded-agents") {
    return {
      canonicalPath: "/agents",
      organizationSlug,
      projectSlug,
    };
  }

  if (PROJECT_ROOTS.has(rest[0])) {
    return {
      canonicalPath: `/${rest.join("/")}`,
      organizationSlug,
      projectSlug,
    };
  }

  return null;
}

/**
 * Cencori OAuth: the permissions an app can be given. Plain values and functions with nothing
 * that needs a server, so browser code can import them (lib/oauth/protocol.ts re-exports them).
 */

/**
 * What an app can be given. Each is one kind of thing at one level; write includes read.
 * Add to the end: the consent screen lists them in this order.
 */
export const OAUTH_SCOPES = [
  "organization:read",
  "projects:read",
  "projects:write",
  "api_keys:read",
  "api_keys:write",
  "usage:read",
] as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[number];

const SCOPE_SET: ReadonlySet<string> = new Set(OAUTH_SCOPES);

export function isOAuthScope(value: unknown): value is OAuthScope {
  return typeof value === "string" && SCOPE_SET.has(value);
}

/**
 * The `scope` parameter (space-separated) as a list in the canonical order, without repeats.
 * Null when it names anything unknown: an app asking for something that does not exist is
 * refused, not quietly given less.
 */
export function parseScopes(value: unknown): OAuthScope[] | null {
  if (typeof value !== "string") return null;
  const asked = value.split(/\s+/).filter(Boolean);
  if (asked.length === 0 || asked.length > OAUTH_SCOPES.length * 2) return null;
  if (!asked.every(isOAuthScope)) return null;
  return OAUTH_SCOPES.filter((scope) => asked.includes(scope));
}

export function formatScopes(scopes: readonly string[]): string {
  return OAUTH_SCOPES.filter((scope) => scopes.includes(scope)).join(" ");
}

/** True when every scope asked for is one the app registered. */
export function scopesWithin(asked: readonly string[], allowed: readonly string[]): boolean {
  return asked.every((scope) => allowed.includes(scope));
}

/** Whether a token holding `granted` may do something that needs `needed`. Write covers read. */
export function scopeAllows(granted: readonly string[], needed: OAuthScope): boolean {
  if (granted.includes(needed)) return true;
  const [resource, level] = needed.split(":");
  return level === "read" && granted.includes(`${resource}:write`);
}

export type ScopeGroup = {
  resource: string;
  label: string;
  level: "read" | "write";
  description: string;
};

const RESOURCES: Array<{ resource: string; label: string; read: string; write: string }> = [
  {
    resource: "organization",
    label: "Organization",
    read: "See the organization's name, plan and members.",
    write: "",
  },
  {
    resource: "projects",
    label: "Projects",
    read: "See the organization's projects.",
    write: "See, create and rename the organization's projects.",
  },
  {
    resource: "api_keys",
    label: "API keys",
    read: "See which API keys exist. It cannot read a key's value.",
    write: "Create and revoke API keys. A key it creates can call models on the organization's bill.",
  },
  {
    resource: "usage",
    label: "Usage",
    read: "See requests, tokens and cost for the organization's projects.",
    write: "",
  },
];

/** The scopes as the consent screen shows them: one row for each kind of thing, at its highest level. */
export function describeScopes(scopes: readonly string[]): ScopeGroup[] {
  const groups: ScopeGroup[] = [];
  for (const item of RESOURCES) {
    const write = scopes.includes(`${item.resource}:write`);
    const read = scopes.includes(`${item.resource}:read`);
    if (!write && !read) continue;
    groups.push({
      resource: item.resource,
      label: item.label,
      level: write ? "write" : "read",
      description: write ? item.write : item.read,
    });
  }
  return groups;
}

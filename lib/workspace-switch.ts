import { isReservedSlug } from "@/lib/reserved-slugs";

/**
 * Rebuild a slug-host workspace URL (`/{org}/{project}/*` or `/{org}/~/*`)
 * for a different org/project while keeping the current subpath.
 *
 * Switching workspace should preserve location — logs stays logs — instead
 * of resetting to the project overview. Returns null when the current path
 * isn't a workspace URL at all (caller falls back to an overview page).
 */
export function swapWorkspaceInPath(
  pathname: string,
  nextOrgSlug: string,
  nextProjectSlug: string | null,
): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  if (isReservedSlug(segments[0])) return null;

  // Bare /{org} → the new workspace overview.
  if (segments.length === 1) {
    return nextProjectSlug ? `/${nextOrgSlug}/${nextProjectSlug}` : `/${nextOrgSlug}/~/projects`;
  }

  // Org-scoped /{org}/~/* stays org-scoped under the new org.
  if (segments[1] === "~") {
    return `/${nextOrgSlug}/${segments.slice(1).join("/")}`;
  }

  // Project-scoped /{org}/{project}/* keeps its subpath under the new
  // project. Without one (org has no projects) there is no project page
  // to preserve — land on the new org's project list instead.
  if (!nextProjectSlug) return `/${nextOrgSlug}/~/projects`;
  return `/${nextOrgSlug}/${nextProjectSlug}/${segments.slice(2).join("/")}`.replace(/\/$/, "");
}

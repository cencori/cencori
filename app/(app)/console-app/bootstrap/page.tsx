import { redirect } from "next/navigation";
import { getActiveConsoleOrganization, getActiveConsoleWorkspace } from "@/lib/console/active-workspace";
import {
  buildScopedConsolePath,
  CONSOLE_BOOTSTRAP_PATH_PARAM,
  getConsoleRoute,
} from "@/lib/console/routing";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// A direct deep link (e.g. /ai-gateway) before the workspace cookies exist.
// Resolving here and redirecting to the slug URL lets the proxy's canonical
// redirect set the cookies and land back on the requested URL — no client
// render, context fetch, or refresh, so no placeholder paints before the
// real page and its own skeletons.
export default async function ConsoleWorkspaceBootstrapPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requested = params[CONSOLE_BOOTSTRAP_PATH_PARAM];
  // Only paths the console router accepts — never an arbitrary redirect target.
  const route = typeof requested === "string" ? getConsoleRoute(requested) : null;
  if (!route) redirect("/home");

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === CONSOLE_BOOTSTRAP_PATH_PARAM || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const search = query.size ? `?${query}` : "";

  const workspace = await getActiveConsoleWorkspace();
  if (workspace) {
    const scopedPath = buildScopedConsolePath(
      route,
      workspace.organization.slug,
      workspace.project.slug,
    );
    if (scopedPath) redirect(`${scopedPath}${search}`);
  }

  // No project yet. Organization-scoped pages still work; project pages send
  // users with an organization to project creation, and users without one to
  // org creation (mirrors console-app/home).
  const organization = await getActiveConsoleOrganization();
  if (!organization) redirect("/onboarding");
  if (route.scope === "organization") {
    const scopedPath = buildScopedConsolePath(route, organization.slug);
    if (scopedPath) redirect(`${scopedPath}${search}`);
  }
  redirect("/projects");
}

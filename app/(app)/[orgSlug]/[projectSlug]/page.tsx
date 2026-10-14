import { ConsoleHomeOverview } from "@/components/dashboard/project-overview/ConsoleHomeOverview";

// No data fetching here: the page renders its UI immediately and each card
// loads its own data client-side behind its own skeleton. The org layout has
// already checked the session, and an unknown org or project is handled by
// the layout's WorkspaceUnavailable state.
export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
  const { orgSlug, projectSlug } = await params;

  return <ConsoleHomeOverview orgSlug={orgSlug} projectSlug={projectSlug} consoleMode={false} />;
}

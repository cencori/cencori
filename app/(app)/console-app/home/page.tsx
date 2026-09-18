import { redirect } from "next/navigation";
import { DeveloperQuickstart } from "@/components/dashboard/project-overview/DeveloperQuickstart";
import OrganizationLayoutClient from "../../[orgSlug]/OrganizationLayoutClient";
import { getActiveConsoleWorkspace } from "@/lib/console/active-workspace";

export default async function ConsoleHomePage() {
  const workspace = await getActiveConsoleWorkspace();
  if (!workspace) redirect("/onboarding");

  return (
    <OrganizationLayoutClient
      workspace={{
        orgSlug: workspace.organization.slug,
        projectSlug: workspace.project.slug,
        consoleMode: true,
      }}
    >
      <DeveloperQuickstart
        orgSlug={workspace.organization.slug}
        projectSlug={workspace.project.slug}
      />
    </OrganizationLayoutClient>
  );
}


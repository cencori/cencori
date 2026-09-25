import { redirect } from "next/navigation";
import { ConsoleHomeOverview } from "@/components/dashboard/project-overview/ConsoleHomeOverview";
import OrganizationLayoutClient from "../../[orgSlug]/OrganizationLayoutClient";
import { getActiveConsoleWorkspace } from "@/lib/console/active-workspace";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export default async function ConsoleHomePage() {
  const workspace = await getActiveConsoleWorkspace();
  if (!workspace) redirect("/onboarding");

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let initialFirstName: string | null =
    user?.user_metadata?.first_name
    || user?.user_metadata?.given_name
    || user?.user_metadata?.name?.split(" ")[0]
    || null;

  if (user && !initialFirstName) {
    try {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("user_profiles")
        .select("first_name")
        .eq("id", user.id)
        .single();
      if (profile?.first_name) initialFirstName = profile.first_name;
    } catch {
      // Fall back to metadata-derived name.
    }
  }

  let initialBalance: number | null = null;
  try {
    const { data: org } = await supabase
      .from("organizations")
      .select("credits_balance")
      .eq("id", workspace.organization.id)
      .single();
    if (org) initialBalance = Number(org.credits_balance ?? 0);
  } catch {
    // Client component refetches; a missing initial value just skeletons.
  }

  return (
    <OrganizationLayoutClient
      workspace={{
        orgSlug: workspace.organization.slug,
        projectSlug: workspace.project.slug,
        consoleMode: true,
      }}
    >
      <ConsoleHomeOverview
        orgId={workspace.organization.id}
        orgName={workspace.organization.name}
        orgSlug={workspace.organization.slug}
        projectId={workspace.project.id}
        projectName={workspace.project.name}
        projectSlug={workspace.project.slug}
        initialBalance={initialBalance}
        initialFirstName={initialFirstName}
        consoleMode
      />
    </OrganizationLayoutClient>
  );
}


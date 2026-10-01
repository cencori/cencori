import { redirect } from "next/navigation";
import { ConsoleHomeOverview } from "@/components/dashboard/project-overview/ConsoleHomeOverview";
import OrganizationLayoutClient from "../../[orgSlug]/OrganizationLayoutClient";
import { getActiveConsoleWorkspace } from "@/lib/console/active-workspace";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export default async function ConsoleHomePage() {
  const supabase = await createServerClient();

  // Workspace resolution and session are independent — together, not series.
  const [workspace, { data: { user } }] = await Promise.all([
    getActiveConsoleWorkspace(),
    supabase.auth.getUser(),
  ]);
  if (!workspace) redirect("/onboarding");

  // First name and balance fan out from (workspace, user) — also parallel.
  const [firstNameResult, balanceResult] = await Promise.all([
    (async (): Promise<string | null> => {
      const fromMetadata =
        user?.user_metadata?.first_name
        || user?.user_metadata?.given_name
        || user?.user_metadata?.name?.split(" ")[0]
        || null;
      if (fromMetadata) return fromMetadata;
      if (!user) return null;
      try {
        const admin = createAdminClient();
        const { data: profile } = await admin
          .from("user_profiles")
          .select("first_name")
          .eq("id", user.id)
          .single();
        if (profile?.first_name) return profile.first_name;
      } catch {
        // Fall back to metadata-derived name.
      }
      return null;
    })(),
    supabase
      .from("organizations")
      .select("credits_balance")
      .eq("id", workspace.organization.id)
      .single(),
  ]);

  let initialBalance: number | null = null;
  try {
    if (balanceResult.data) initialBalance = Number(balanceResult.data.credits_balance ?? 0);
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
        initialFirstName={firstNameResult}
        consoleMode
      />
    </OrganizationLayoutClient>
  );
}


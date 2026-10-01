import { notFound } from "next/navigation";
import { ConsoleHomeOverview } from "@/components/dashboard/project-overview/ConsoleHomeOverview";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getOrganizationMeta } from "@/lib/server/organization";

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
  const { orgSlug, projectSlug } = await params;
  const supabase = await createServerClient();

  // The org row (shared per-request cache with generateMetadata) and the
  // session are independent — resolve them together, not in series.
  const [organization, { data: { user } }] = await Promise.all([
    getOrganizationMeta(orgSlug),
    supabase.auth.getUser(),
  ]);
  if (!organization) notFound();

  // Project, balance, and profile fan out from (org, user) — also parallel.
  const [projectResult, balanceResult, profileResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, slug")
      .eq("organization_id", organization.id)
      .eq("slug", projectSlug)
      .single(),
    supabase
      .from("organizations")
      .select("credits_balance")
      .eq("id", organization.id)
      .single(),
    (async () => {
      const firstName =
        user?.user_metadata?.first_name
        || user?.user_metadata?.given_name
        || user?.user_metadata?.name?.split(" ")[0]
        || null;
      if (user && !firstName) {
        try {
          const admin = createAdminClient();
          const { data: profile } = await admin
            .from("user_profiles")
            .select("first_name")
            .eq("id", user.id)
            .single();
          if (profile?.first_name) return profile.first_name as string;
        } catch {
          // Fall back to metadata-derived name.
        }
      }
      return firstName;
    })(),
  ]);

  if (!projectResult.data) notFound();
  const project = projectResult.data;

  let initialBalance: number | null = null;
  try {
    if (balanceResult.data) initialBalance = Number(balanceResult.data.credits_balance ?? 0);
  } catch {
    // Client component refetches; a missing initial value just skeletons.
  }

  return (
    <ConsoleHomeOverview
      orgId={organization.id}
      orgName={organization.name}
      orgSlug={organization.slug}
      projectId={project.id}
      projectName={project.name}
      projectSlug={project.slug}
      initialBalance={initialBalance}
      initialFirstName={profileResult}
      consoleMode={false}
    />
  );
}

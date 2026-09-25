import { notFound } from "next/navigation";
import { ConsoleHomeOverview } from "@/components/dashboard/project-overview/ConsoleHomeOverview";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
  const { orgSlug, projectSlug } = await params;
  const supabase = await createServerClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", orgSlug)
    .single();
  if (!organization) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, slug")
    .eq("organization_id", organization.id)
    .eq("slug", projectSlug)
    .single();
  if (!project) notFound();

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
      .eq("id", organization.id)
      .single();
    if (org) initialBalance = Number(org.credits_balance ?? 0);
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
      initialFirstName={initialFirstName}
      consoleMode={false}
    />
  );
}

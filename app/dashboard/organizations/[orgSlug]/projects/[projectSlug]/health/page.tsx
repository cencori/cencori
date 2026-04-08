import { createServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import ModelAvailabilityDashboard from "@/components/dashboard/ModelAvailabilityDashboard";

interface PageProps {
  params: {
    orgSlug: string;
    projectSlug: string;
  };
}

export default async function ModelHealthPage({ params }: PageProps) {
  const { orgSlug, projectSlug } = params;

  // 1. Authenticate — redirect to login if not signed in
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // 2. Resolve projectId from slug
  //    This is the same pattern used by other project pages in the dashboard.
  //    Adjust the query to match how your codebase looks up projects by slug.
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("slug", projectSlug)
    .single();

  if (!project) {
    return (
      <div className="w-full max-w-5xl mx-auto px-6 py-16 text-center">
        <p className="text-sm font-medium text-gray-900 mb-1">
          Project not found
        </p>
        <p className="text-xs text-gray-500">
          The project &quot;{projectSlug}&quot; does not exist or you do not
          have access.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-base font-medium">Model Availability</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Real-time health status of all AI models configured for this project.
          Auto-refreshes every 30 seconds.
        </p>
      </div>

      {/* Dashboard component — all the logic lives here */}
      <ModelAvailabilityDashboard
        projectId={project.id}
        orgSlug={orgSlug}
        projectSlug={projectSlug}
      />
    </div>
  );
}

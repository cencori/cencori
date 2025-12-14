import { Metadata } from "next";
import { createServerClient } from "@/lib/supabaseServer";
import ProjectLayoutClient from "./ProjectLayoutClient";

type LayoutParams = Promise<{ orgSlug: string; projectSlug: string }>;

export async function generateMetadata({
  params,
}: {
  params: LayoutParams;
}): Promise<Metadata> {
  const { orgSlug, projectSlug } = await params;

  try {
    const supabase = await createServerClient();

    // Fetch organization first
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("slug", orgSlug)
      .single();

    if (!org) {
      return { title: "Project" };
    }

    // Fetch project
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("slug", projectSlug)
      .eq("organization_id", org.id)
      .single();

    if (project?.name && org?.name) {
      return {
        title: `${project.name} - ${org.name}`,
      };
    }
  } catch (error) {
    console.error("Error fetching project for metadata:", error);
  }

  return {
    title: "Project",
  };
}

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: LayoutParams;
}) {
  return (
    <ProjectLayoutClient params={params}>
      {children}
    </ProjectLayoutClient>
  );
}

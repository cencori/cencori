import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabaseServer";
import {
  ACTIVE_ORG_COOKIE,
  ACTIVE_PROJECT_COOKIE,
} from "@/lib/console/routing";

export interface ActiveConsoleWorkspace {
  organization: {
    id: string;
    name: string;
    slug: string;
    subscriptionTier: string | null;
  };
  project: {
    id: string;
    name: string;
    slug: string;
    organizationId: string;
  };
}

/**
 * Resolve the workspace used by project-centric console URLs such as /home.
 *
 * Cookie values are preferences, never authorization. Both organization and
 * project reads still pass through the signed-in user's RLS policies before a
 * workspace can be returned.
 */
export const getActiveConsoleWorkspace = cache(async (): Promise<ActiveConsoleWorkspace | null> => {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const preferredOrgSlug = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  const preferredProjectSlug = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value ?? null;

  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id, name, slug, subscription_tier");

  if (organizationsError) {
    throw new Error(`Could not load console organizations: ${organizationsError.message}`);
  }
  if (!organizations?.length) return null;

  const organizationIds = organizations.map((organization) => organization.id);
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, slug, organization_id")
    .in("organization_id", organizationIds);

  if (projectsError) {
    throw new Error(`Could not load console projects: ${projectsError.message}`);
  }
  if (!projects?.length) return null;

  const preferredOrganization = preferredOrgSlug
    ? organizations.find((organization) => organization.slug === preferredOrgSlug)
    : null;

  const project = (
    preferredOrganization && preferredProjectSlug
      ? projects.find((candidate) => (
          candidate.organization_id === preferredOrganization.id &&
          candidate.slug === preferredProjectSlug
        ))
      : null
  ) ?? (
    preferredOrganization
      ? projects.find((candidate) => candidate.organization_id === preferredOrganization.id)
      : null
  ) ?? projects[0];

  const organization = organizations.find((candidate) => candidate.id === project.organization_id);
  if (!organization) return null;

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      subscriptionTier: organization.subscription_tier ?? null,
    },
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      organizationId: project.organization_id,
    },
  };
});


import { getAuthUser } from "@/lib/auth/get-auth-user";
import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabaseServer";
import { withSupabaseRetry } from "@/lib/supabase-retry";
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

export interface ActiveConsoleOrganization {
  id: string;
  name: string;
  slug: string;
  subscriptionTier: string | null;
}

/**
 * Resolve the organization used by organization-scoped console URLs such as
 * /projects or /billing.
 *
 * Unlike {@link getActiveConsoleWorkspace} this does not require a project:
 * a user whose organization exists but has no projects yet (fresh Google
 * sign-up, invite accepted before project creation) still has an org context.
 * Returning null here means the user genuinely has no organization and the
 * org-creation onboarding is the right destination.
 */
export const getActiveConsoleOrganization = cache(async (): Promise<ActiveConsoleOrganization | null> => {
  const supabase = await createServerClient();
  const { data: { user } } = await withSupabaseRetry(
    () => getAuthUser(supabase),
    { operation: "console org auth.getUser" },
  );
  if (!user) return null;

  const cookieStore = await cookies();
  const preferredOrgSlug = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;

  const { data: organizations, error: organizationsError } = await withSupabaseRetry(
    () => supabase
      .from("organizations")
      .select("id, name, slug, subscription_tier"),
    { operation: "console org organizations" },
  );

  if (organizationsError) {
    throw new Error(`Could not load console organizations: ${organizationsError.message}`);
  }
  if (!organizations?.length) return null;

  const organization = (
    preferredOrgSlug
      ? organizations.find((candidate) => candidate.slug === preferredOrgSlug)
      : null
  ) ?? organizations[0];
  if (!organization) return null;

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    subscriptionTier: organization.subscription_tier ?? null,
  };
});

/**
 * Resolve the workspace used by project-centric console URLs such as /home.
 *
 * Cookie values are preferences, never authorization. Both organization and
 * project reads still pass through the signed-in user's RLS policies before a
 * workspace can be returned. Returns null when the user has no project yet —
 * callers must fall back to {@link getActiveConsoleOrganization} (org-level
 * routes such as /projects) instead of sending the user back to org creation.
 */
export const getActiveConsoleWorkspace = cache(async (): Promise<ActiveConsoleWorkspace | null> => {
  const supabase = await createServerClient();
  // Auth + workspace reads each get 4 attempts with backoff: a single
  // Vercel->Supabase socket blip (UND_ERR_SOCKET/ECONNRESET, Oct 2026
  // incident) must not take down /home, /login, /billing, /memory.
  const { data: { user } } = await withSupabaseRetry(
    () => getAuthUser(supabase),
    { operation: "console auth.getUser" },
  );
  if (!user) return null;

  const cookieStore = await cookies();
  const preferredOrgSlug = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  const preferredProjectSlug = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value ?? null;

  const { data: organizations, error: organizationsError } = await withSupabaseRetry(
    () => supabase
      .from("organizations")
      .select("id, name, slug, subscription_tier"),
    { operation: "console organizations" },
  );

  if (organizationsError) {
    throw new Error(`Could not load console organizations: ${organizationsError.message}`);
  }
  if (!organizations?.length) return null;

  const organizationIds = organizations.map((organization) => organization.id);
  const { data: projects, error: projectsError } = await withSupabaseRetry(
    () => supabase
      .from("projects")
      .select("id, name, slug, organization_id")
      .in("organization_id", organizationIds),
    { operation: "console projects" },
  );

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


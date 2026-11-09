"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";
import { normalizeProjectId } from "@/lib/project-id";

// Query keys for cache management
export const queryKeys = {
    organizations: ["organizations"] as const,
    projects: (orgId?: string) => ["projects", orgId] as const,
    projectDetails: (projectId: string) => ["project", projectId] as const,
    orgDetails: (orgSlug: string) => ["organization", orgSlug] as const,
    providers: (projectId: string) => ["providers", projectId] as const,
    apiKeys: (projectId: string) => ["apiKeys", projectId] as const,
    logs: (projectId: string, filters?: object) => ["logs", projectId, filters] as const,
    analytics: (projectId: string, range?: string) => ["analytics", projectId, range] as const,
    projectIdBySlug: (orgSlug: string, projectSlug: string) => ["projectId", orgSlug, projectSlug] as const,
    projectDetailsBySlug: (orgSlug: string, projectSlug: string) => ["projectDetailsBySlug", orgSlug, projectSlug] as const,
};

/**
 * Resolve a project slug without making every project page repeat the same
 * organization -> project lookup. The application shell already owns this
 * identity data, so seed React Query from that cache and refresh it in the
 * background. This prevents a second, identity-only loading screen before a
 * page can start loading its actual content.
 */
export function useProjectIdBySlug(orgSlug: string, projectSlug: string) {
    const {
        organizations,
        projects,
    } = useOrganizationProject();

    const cachedProjectId = useMemo(() => {
        const organization = organizations.find((item) => item.slug === orgSlug);
        if (!organization) return undefined;

        return projects.find((item) => (
            item.slug === projectSlug && item.organization_id === organization.id
        ))?.id;
    }, [organizations, projects, orgSlug, projectSlug]);

    const query = useQuery<unknown, Error, string | undefined>({
        queryKey: queryKeys.projectIdBySlug(orgSlug, projectSlug),
        queryFn: async () => {
            const { data: organization, error: organizationError } = await supabase
                .from("organizations")
                .select("id")
                .eq("slug", orgSlug)
                .single();

            if (organizationError) throw organizationError;

            const { data: project, error: projectError } = await supabase
                .from("projects")
                .select("id")
                .eq("slug", projectSlug)
                .eq("organization_id", organization.id)
                .single();

            if (projectError) throw projectError;
            return project.id;
        },
        // A previous Edge page implementation used this same cache key for
        // { projectId, projectName }. Normalize that shape so warm sessions
        // recover immediately while the newly separated keys take effect.
        select: normalizeProjectId,
        enabled: Boolean(orgSlug && projectSlug),
        initialData: cachedProjectId,
        initialDataUpdatedAt: cachedProjectId ? 0 : undefined,
        staleTime: 5 * 60 * 1000,
    });

    const projectId = query.data ?? cachedProjectId;

    return {
        ...query,
        data: projectId,
        isLoading: !projectId && query.isLoading,
    };
}


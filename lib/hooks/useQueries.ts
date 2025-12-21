"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

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
};

// Fetch all organizations for current user
export function useOrganizations() {
    return useQuery({
        queryKey: queryKeys.organizations,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("organizations")
                .select("id, name, slug, subscription_tier");

            if (error) throw error;
            return data || [];
        },
    });
}

// Fetch projects for a specific organization
export function useProjects(orgId?: string) {
    return useQuery({
        queryKey: queryKeys.projects(orgId),
        queryFn: async () => {
            if (!orgId) return [];

            const { data, error } = await supabase
                .from("projects")
                .select("id, name, slug, organization_id")
                .eq("organization_id", orgId);

            if (error) throw error;
            return data || [];
        },
        enabled: !!orgId,
    });
}

// Fetch single organization by slug
export function useOrganization(orgSlug: string) {
    return useQuery({
        queryKey: queryKeys.orgDetails(orgSlug),
        queryFn: async () => {
            const { data, error } = await supabase
                .from("organizations")
                .select("id, name, slug, subscription_tier")
                .eq("slug", orgSlug)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!orgSlug,
        staleTime: 60 * 1000, // Org details rarely change
    });
}

// Fetch single project by slug
export function useProject(projectSlug: string, orgId?: string) {
    return useQuery({
        queryKey: queryKeys.projectDetails(projectSlug),
        queryFn: async () => {
            if (!orgId) throw new Error("Organization ID required");

            const { data, error } = await supabase
                .from("projects")
                .select("id, name, slug, organization_id, description")
                .eq("slug", projectSlug)
                .eq("organization_id", orgId)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!projectSlug && !!orgId,
        staleTime: 60 * 1000,
    });
}

// Fetch providers for a project
export function useProviders(projectId: string) {
    return useQuery({
        queryKey: queryKeys.providers(projectId),
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/providers`);
            if (!res.ok) throw new Error("Failed to fetch providers");
            const data = await res.json();
            return data.providers || [];
        },
        enabled: !!projectId,
    });
}

// Fetch API keys for a project
export function useApiKeys(projectId: string) {
    return useQuery({
        queryKey: queryKeys.apiKeys(projectId),
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/api-keys`);
            if (!res.ok) throw new Error("Failed to fetch API keys");
            const data = await res.json();
            return data.apiKeys || [];
        },
        enabled: !!projectId,
    });
}

// Invalidate queries helper
export function useInvalidateQueries() {
    const queryClient = useQueryClient();

    return {
        invalidateOrgs: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations }),
        invalidateProjects: (orgId?: string) => queryClient.invalidateQueries({ queryKey: queryKeys.projects(orgId) }),
        invalidateProviders: (projectId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.providers(projectId) }),
        invalidateApiKeys: (projectId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys(projectId) }),
        invalidateAll: () => queryClient.invalidateQueries(),
    };
}

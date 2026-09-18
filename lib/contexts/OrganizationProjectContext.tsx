"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ORG_PROJECT_CACHE_KEY } from "@/lib/auth/session-caches";
import { getConsoleSurface, isConsoleHostname } from "@/lib/console/routing";

export interface Organization {
    id: string;
    name: string;
    slug: string;
    description?: string;
    subscription_tier?: string;
}

export interface Project {
    id: string;
    name: string;
    slug: string;
    description?: string;
    organization_id: string;
    orgSlug?: string;
}

interface OrganizationProjectContextType {
    organizations: Organization[];
    projects: Project[];
    activeOrganization: Organization | null;
    activeProject: Project | null;
    loading: boolean;
    selectProject: (projectId: string) => Promise<boolean>;
    updateOrganization: (id: string, updates: Partial<Organization>) => void;
    updateProject: (id: string, updates: Partial<Project>) => void;
    refetchData: () => Promise<void>;
}

const OrganizationProjectContext = createContext<OrganizationProjectContextType | undefined>(
    undefined
);

interface OrgProjectCache {
    organizations: Organization[];
    projects: Project[];
    // Which account the cache was written for. Absent on entries written before
    // this field existed — those are treated as belonging to nobody and dropped
    // on the first fetch, which costs one paint and is worth it.
    userId?: string;
}

function loadCache(): OrgProjectCache | null {
    try {
        const raw = sessionStorage.getItem(ORG_PROJECT_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.organizations) && Array.isArray(parsed.projects)) {
            return parsed;
        }
    } catch { /* ignore corrupt cache */ }
    return null;
}

function saveCache(organizations: Organization[], projects: Project[], userId: string) {
    try {
        sessionStorage.setItem(
            ORG_PROJECT_CACHE_KEY,
            JSON.stringify({ organizations, projects, userId } satisfies OrgProjectCache),
        );
    } catch { /* storage full, ignore */ }
}

export const OrganizationProjectProvider = ({ children }: { children: ReactNode }) => {
    const cached = useMemo(() => loadCache(), []);
    const [organizations, setOrganizations] = useState<Organization[]>(cached?.organizations ?? []);
    const [projects, setProjects] = useState<Project[]>(cached?.projects ?? []);
    const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    // Cached organizations/projects can paint the shell immediately, but the
    // active console workspace still has to be resolved on every page load.
    // Keep this true through that first refresh so consumers never mistake a
    // warm cache for a fully resolved active project.
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession();

            if (sessionError || !session?.user) {
                console.error("User not logged in:", sessionError?.message);
                setLoading(false);
                return;
            }

            // The cache is per-tab, so a sign-out or account switch that
            // happened in a *different* tab leaves it holding the previous
            // account's workspaces — which is what used to keep rendering their
            // org and project names in the breadcrumbs after the identity had
            // already changed. Drop it before anything paints.
            if (cached && cached.userId !== session.user.id) {
                setOrganizations([]);
                setProjects([]);
            }

            // Fetch organizations
            const { data: orgsData, error: orgsError } = await supabase
                .from("organizations")
                .select("id, name, slug, subscription_tier");

            if (orgsError) {
                console.error("Error fetching organizations:", orgsError.message);
            } else {
                setOrganizations(orgsData || []);
            }

            // Fetch projects
            let projectsWithOrgSlug: Project[] = [];
            if (orgsData && orgsData.length > 0) {
                const orgIds = orgsData.map((org) => org.id);
                const { data: projectsData, error: projectsError } = await supabase
                    .from("projects")
                    .select("id, name, slug, organization_id")
                    .in("organization_id", orgIds);

                if (projectsError) {
                    console.error("Error fetching projects:", projectsError.message);
                } else {
                    // Map project data to include orgSlug
                    projectsWithOrgSlug =
                        projectsData?.map((proj) => ({
                            ...proj,
                            orgSlug: orgsData.find((org) => org.id === proj.organization_id)?.slug,
                        })) || [];
                    setProjects(projectsWithOrgSlug);
                }
            }

            // Canonical console URLs intentionally omit tenant slugs. Resolve
            // the user's selected workspace separately so the shell can keep
            // rendering the correct organization and project switchers.
            const isCanonicalConsoleRoute = (
                typeof window !== "undefined" &&
                isConsoleHostname(window.location.hostname) &&
                getConsoleSurface(window.location.pathname) !== null
            );
            if (isCanonicalConsoleRoute) {
                try {
                    const contextResponse = await fetch("/api/console/context", {
                        cache: "no-store",
                        credentials: "same-origin",
                    });
                    if (contextResponse.ok) {
                        const payload = await contextResponse.json() as {
                            workspace?: {
                                organization?: { id?: string };
                                project?: { id?: string };
                            } | null;
                        };
                        setActiveOrganizationId(payload.workspace?.organization?.id ?? null);
                        setActiveProjectId(payload.workspace?.project?.id ?? null);
                    }
                } catch {
                    // The slug-based routes remain fully usable if context
                    // resolution is temporarily unavailable.
                }
            }

            saveCache(orgsData || [], projectsWithOrgSlug, session.user.id);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }, [cached]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const updateOrganization = (id: string, updates: Partial<Organization>) => {
        setOrganizations((prev) =>
            prev.map((org) => (org.id === id ? { ...org, ...updates } : org))
        );
    };

    const updateProject = (id: string, updates: Partial<Project>) => {
        setProjects((prev) => prev.map((proj) => (proj.id === id ? { ...proj, ...updates } : proj)));
    };

    const selectProject = useCallback(async (projectId: string) => {
        const response = await fetch("/api/console/context", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ projectId }),
        });

        if (!response.ok) return false;

        const payload = await response.json() as {
            workspace?: {
                organization?: { id?: string };
                project?: { id?: string };
            };
        };
        setActiveOrganizationId(payload.workspace?.organization?.id ?? null);
        setActiveProjectId(payload.workspace?.project?.id ?? null);
        return true;
    }, []);

    const activeOrganization = useMemo(
        () => organizations.find((organization) => organization.id === activeOrganizationId) ?? null,
        [activeOrganizationId, organizations],
    );
    const activeProject = useMemo(
        () => projects.find((project) => project.id === activeProjectId) ?? null,
        [activeProjectId, projects],
    );

    const refetchData = async () => {
        await fetchData();
    };

    return (
        <OrganizationProjectContext.Provider
            value={{
                organizations,
                projects,
                activeOrganization,
                activeProject,
                loading,
                selectProject,
                updateOrganization,
                updateProject,
                refetchData,
            }}
        >
            {children}
        </OrganizationProjectContext.Provider>
    );
};

export const useOrganizationProject = () => {
    const context = useContext(OrganizationProjectContext);
    if (context === undefined) {
        throw new Error("useOrganizationProject must be used within an OrganizationProjectProvider");
    }
    return context;
};

"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface Organization {
    id: string;
    name: string;
    slug: string;
    description?: string;
    plan?: string;
}

interface Project {
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
    loading: boolean;
    updateOrganization: (id: string, updates: Partial<Organization>) => void;
    updateProject: (id: string, updates: Partial<Project>) => void;
    refetchData: () => Promise<void>;
}

const OrganizationProjectContext = createContext<OrganizationProjectContextType | undefined>(
    undefined
);

export const OrganizationProjectProvider = ({ children }: { children: ReactNode }) => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );

    const fetchData = async () => {
        setLoading(true);
        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                console.error("User not logged in:", userError?.message);
                setLoading(false);
                return;
            }

            // Fetch organizations
            const { data: orgsData, error: orgsError } = await supabase
                .from("organizations")
                .select("id, name, slug, plan");

            if (orgsError) {
                console.error("Error fetching organizations:", orgsError.message);
            } else {
                setOrganizations(orgsData || []);
            }

            // Fetch projects
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
                    const projectsWithOrgSlug =
                        projectsData?.map((proj) => ({
                            ...proj,
                            orgSlug: orgsData.find((org) => org.id === proj.organization_id)?.slug,
                        })) || [];
                    setProjects(projectsWithOrgSlug);
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const updateOrganization = (id: string, updates: Partial<Organization>) => {
        setOrganizations((prev) =>
            prev.map((org) => (org.id === id ? { ...org, ...updates } : org))
        );
    };

    const updateProject = (id: string, updates: Partial<Project>) => {
        setProjects((prev) => prev.map((proj) => (proj.id === id ? { ...proj, ...updates } : proj)));
    };

    const refetchData = async () => {
        await fetchData();
    };

    return (
        <OrganizationProjectContext.Provider
            value={{
                organizations,
                projects,
                loading,
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

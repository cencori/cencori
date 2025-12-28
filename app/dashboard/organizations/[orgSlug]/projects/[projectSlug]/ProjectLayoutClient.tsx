"use client";

import React, { use } from "react";
import Link from "next/link";
import { notFound, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

import {
    Sidebar,
    SidebarContent,
    SidebarProvider,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarRail,
    SidebarGroup,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { PanelTopIcon } from "@/components/animate-ui/icons/panel-top";
import { SettingsIcon } from "@/components/animate-ui/icons/settings";
import { Key, ScrollText, ShieldAlert, Activity, Server, Puzzle, Cpu } from "lucide-react";
import { BeakerIcon } from "@/components/icons/BeakerIcon";
import { useMobileSheet } from "@/lib/contexts/MobileSheetContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface ProjectData {
    id: string;
    name: string;
    slug: string;
    organization_id: string;
}

interface OrganizationData {
    id: string;
    name: string;
    slug: string;
}

type LayoutParams = Promise<{ orgSlug: string; projectSlug: string }>;

// Hook to fetch project and org with caching
function useProjectLayout(orgSlug: string, projectSlug: string) {
    return useQuery({
        queryKey: ["projectLayout", orgSlug, projectSlug],
        queryFn: async () => {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) throw new Error("Not authenticated");

            const { data: orgData, error: orgError } = await supabase
                .from("organizations")
                .select("id, name, slug")
                .eq("slug", orgSlug)
                .single();

            if (orgError || !orgData) throw new Error("Organization not found");

            const { data: projectData, error: projectError } = await supabase
                .from("projects")
                .select("id, name, slug, organization_id")
                .eq("slug", projectSlug)
                .eq("organization_id", orgData.id)
                .single();

            if (projectError || !projectData) throw new Error("Project not found");

            return {
                organization: orgData as OrganizationData,
                project: projectData as ProjectData,
            };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes - layout data rarely changes
    });
}

// Prefetch helper for project pages
async function prefetchProjectPage(
    queryClient: ReturnType<typeof useQueryClient>,
    projectId: string,
    pageType: string
) {
    // Prefetch common data based on page type
    const prefetchMap: Record<string, () => Promise<void>> = {
        "api-keys": async () => {
            await queryClient.prefetchQuery({
                queryKey: ["apiKeys", projectId],
                queryFn: async () => {
                    const response = await fetch(`/api/projects/${projectId}/api-keys`);
                    return response.json();
                },
                staleTime: 30 * 1000,
            });
        },
        providers: async () => {
            await queryClient.prefetchQuery({
                queryKey: ["projectProviders", projectId],
                queryFn: async () => {
                    const response = await fetch(`/api/projects/${projectId}/providers`);
                    return response.json();
                },
                staleTime: 30 * 1000,
            });
        },
        analytics: async () => {
            await queryClient.prefetchQuery({
                queryKey: ["analyticsStats", projectId, "7d"],
                queryFn: async () => {
                    const response = await fetch(`/api/projects/${projectId}/ai/stats?period=7d`);
                    return response.json();
                },
                staleTime: 30 * 1000,
            });
        },
    };

    const prefetchFn = prefetchMap[pageType];
    if (prefetchFn) {
        try {
            await prefetchFn();
        } catch (error) {
            console.debug("[ProjectLayout] Prefetch failed:", error);
        }
    }
}

// Sidebar link with prefetching
function ProjectSidebarLink({
    href,
    icon: Icon,
    label,
    isActive,
    prefetch,
    onClick,
}: {
    href: string;
    icon: React.ComponentType<{ animateOnHover?: boolean; className?: string }>;
    label: string;
    isActive: boolean;
    prefetch?: () => void;
    onClick?: () => void;
}) {
    const handleMouseEnter = () => {
        if (prefetch) {
            setTimeout(prefetch, 100);
        }
    };

    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={label} isActive={isActive}>
                <Link href={href} onMouseEnter={handleMouseEnter} onClick={onClick}>
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

export default function ProjectLayoutClient({
    children,
    params,
}: {
    children: React.ReactNode;
    params: LayoutParams;
}) {
    const { orgSlug, projectSlug } = use(params);
    const pathname = usePathname();
    const queryClient = useQueryClient();
    const { isOpen, setIsOpen } = useMobileSheet();

    // Fetch project and org with caching - INSTANT ON REVISIT!
    const { data, isLoading, error } = useProjectLayout(orgSlug, projectSlug);
    const organization = data?.organization;
    const project = data?.project;

    // Helper to check if a route is active
    const isActive = (path: string) => {
        if (path.endsWith(projectSlug || '')) {
            return pathname === path;
        }
        return pathname.startsWith(path);
    };

    // Only show not found if there's an error (not while loading)
    if (error) {
        notFound();
    }

    // Use URL params directly for nav - no need to wait for query!
    const basePath = `/dashboard/organizations/${orgSlug}/projects/${projectSlug}`;

    // Create prefetch functions for data-heavy pages (only if project data is loaded)
    const createPrefetch = (pageType: string) => () => {
        if (project?.id) {
            prefetchProjectPage(queryClient, project.id, pageType);
        }
    };

    const navItems = [
        { href: basePath, icon: PanelTopIcon, label: "Project Overview" },
        { href: `${basePath}/providers`, icon: Cpu, label: "Providers", prefetch: createPrefetch("providers") },
        { href: `${basePath}/logs`, icon: ScrollText, label: "Logs" },
        { href: `${basePath}/security`, icon: ShieldAlert, label: "Security" },
        { href: `${basePath}/custom-providers`, icon: Server, label: "Custom Providers" },
        { href: `${basePath}/analytics`, icon: Activity, label: "Analytics", prefetch: createPrefetch("analytics") },
        { href: `${basePath}/playground`, icon: BeakerIcon, label: "Playground" },
        { href: `${basePath}/edge`, icon: Puzzle, label: "Edge" },
        { href: `${basePath}/settings`, icon: SettingsIcon, label: "Project Settings" },
    ];

    return (
        <SidebarProvider defaultOpen={false}>
            {/* Desktop Sidebar - hidden on mobile */}
            <Sidebar collapsible="icon" expandOnHover className="top-12 h-[calc(100vh-3rem)] hidden lg:block border-r border-border/40">
                <SidebarContent>
                    <SidebarGroup className="pt-3">
                        <SidebarMenu>
                            {navItems.map((item) => (
                                <ProjectSidebarLink
                                    key={item.href}
                                    href={item.href}
                                    icon={item.icon}
                                    label={item.label}
                                    isActive={isActive(item.href)}
                                    prefetch={item.prefetch}
                                />
                            ))}
                        </SidebarMenu>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarRail />
                <div className="absolute bottom-0 left-0 w-full p-2">
                    <SidebarTrigger />
                </div>
            </Sidebar>

            {/* Mobile Sheet */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetContent side="bottom" className="h-[70vh]">
                    <div className="py-3">
                        <SidebarGroup>
                            <SidebarMenu>
                                {navItems.map((item) => (
                                    <ProjectSidebarLink
                                        key={item.href}
                                        href={item.href}
                                        icon={item.icon}
                                        label={item.label}
                                        isActive={isActive(item.href)}
                                        onClick={() => setIsOpen(false)}
                                    />
                                ))}
                            </SidebarMenu>
                        </SidebarGroup>
                    </div>
                </SheetContent>
            </Sheet>

            <main className="flex w-full flex-1 flex-col overflow-hidden">
                {children}
            </main>
        </SidebarProvider>
    );
}

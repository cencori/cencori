"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
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
import { Key, ScrollText, ShieldAlert, Activity, Zap } from "lucide-react";
import { CubeTransparentIcon } from "@heroicons/react/24/outline";
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

export default function ProjectLayoutClient({
    children,
    params,
}: {
    children: React.ReactNode;
    params: LayoutParams;
}) {
    const router = useRouter();
    const [project, setProject] = useState<ProjectData | null>(null);
    const [organization, setOrganization] = useState<OrganizationData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { isOpen, setIsOpen } = useMobileSheet();

    useEffect(() => {
        const fetchProjectAndOrganization = async () => {
            setError(null);
            try {
                const resolvedParams = await params;
                const { orgSlug, projectSlug } = resolvedParams;

                const {
                    data: { user },
                    error: userError,
                } = await supabase.auth.getUser();

                if (userError || !user) {
                    router.push("/login");
                    return;
                }

                const { data: orgData, error: orgError } = await supabase
                    .from("organizations")
                    .select("id, name, slug")
                    .eq("slug", orgSlug)
                    .single();

                if (orgError || !orgData) {
                    console.error("Error fetching organization:", orgError?.message);
                    notFound();
                    return;
                }

                const { data: projectData, error: projectError } = await supabase
                    .from("projects")
                    .select("id, name, slug, organization_id")
                    .eq("slug", projectSlug)
                    .eq("organization_id", orgData.id)
                    .single();

                if (projectError || !projectData) {
                    console.error("Error fetching project:", projectError?.message);
                    notFound();
                    return;
                }

                setOrganization(orgData);
                setProject(projectData);
            } catch (err: unknown) {
                console.error("Unexpected error:", (err as Error).message);
                setError("An unexpected error occurred.");
            }
        };

        fetchProjectAndOrganization();
    }, [params, router]);


    if (error)
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
                <p className="text-sm text-red-500">{error}</p>
            </div>
        );

    // Don't render until we have project and organization data
    if (!project || !organization) return null;

    return (
        <SidebarProvider defaultOpen>
            {/* Desktop Sidebar - hidden on mobile */}
            <Sidebar collapsible="icon" className="top-12 h-[calc(100vh-3rem)] hidden lg:block">
                <SidebarContent>
                    <SidebarGroup className="pt-4">
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Overview">
                                    <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}`}>
                                        <PanelTopIcon animateOnHover />
                                        <span>Project Overview</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="API Keys">
                                    <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}/api-keys`}>
                                        <Key className="h-4 w-4" />
                                        <span>API Keys</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Request Logs">
                                    <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}/logs`}>
                                        <ScrollText className="h-4 w-4" />
                                        <span>Logs</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Security">
                                    <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}/security`}>
                                        <ShieldAlert className="h-4 w-4" />
                                        <span>Security</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Analytics">
                                    <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}/analytics`}>
                                        <Activity className="h-4 w-4" />
                                        <span>Analytics</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Playground">
                                    <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}/playground`}>
                                        <CubeTransparentIcon className="h-4 w-4" />
                                        <span>Playground</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Settings">
                                    <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}/settings`}>
                                        <SettingsIcon animateOnHover />
                                        <span>Project Settings</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarRail />
                <div className="absolute bottom-0 left-0 w-full p-2">
                    <SidebarTrigger />
                </div>
            </Sidebar>

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetContent side="bottom" className="h-[75vh]">
                    <div className="py-4">
                        <SidebarGroup>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}`} onClick={() => setIsOpen(false)}>
                                            <PanelTopIcon animateOnHover />
                                            <span>Project Overview</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}/api-keys`} onClick={() => setIsOpen(false)}>
                                            <Key className="h-4 w-4" />
                                            <span>API Keys</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}/logs`} onClick={() => setIsOpen(false)}>
                                            <ScrollText className="h-4 w-4" />
                                            <span>Request Logs</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}/security`} onClick={() => setIsOpen(false)}>
                                            <ShieldAlert className="h-4 w-4" />
                                            <span>Security Incidents</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}/analytics`} onClick={() => setIsOpen(false)}>
                                            <Activity className="h-4 w-4" />
                                            <span>Analytics</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}/playground`} onClick={() => setIsOpen(false)}>
                                            <CubeTransparentIcon className="h-4 w-4" />
                                            <span>Playground</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <Link href={`/dashboard/organizations/${organization.slug}/projects/${project.slug}/settings`} onClick={() => setIsOpen(false)}>
                                            <SettingsIcon animateOnHover />
                                            <span>Project Settings</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
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

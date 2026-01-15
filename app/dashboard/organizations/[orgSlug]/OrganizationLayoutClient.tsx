"use client";

import React, { useEffect, useState } from "react";
import { notFound, useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
    Sidebar,
    SidebarContent,
    SidebarProvider,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarTrigger,
    SidebarRail,
    SidebarGroup,
    useSidebar,
} from "@/components/ui/sidebar";
import { LayersIcon } from "@/components/animate-ui/icons/layers";
import { SettingsIcon } from "@/components/animate-ui/icons/settings";
import { PanelTopIcon } from "@/components/animate-ui/icons/panel-top";
import { ActivityIcon } from "@/components/animate-ui/icons/activity";
import { UnplugIcon } from "@/components/animate-ui/icons/unplug";
import { UserRoundIcon } from "@/components/animate-ui/icons/user-round";

import { useMobileSheet } from "@/lib/contexts/MobileSheetContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface OrganizationData {
    id: string;
    name: string;
    slug: string;
}

type LayoutParams = { orgSlug: string } | Promise<{ orgSlug: string }>;

// Component that applies sidebar mode from context
function SidebarWithMode({
    children,
    className
}: {
    children: React.ReactNode;
    className?: string;
}) {
    const { sidebarMode } = useSidebar();

    // Map mode to sidebar props
    // Note: We use collapsible="icon" for expanded mode too to get consistent styling
    // The sidebar stays open because we set defaultOpen=true in SidebarProvider
    const sidebarProps = {
        expanded: { collapsible: "icon" as const, expandOnHover: false },
        collapsed: { collapsible: "icon" as const, expandOnHover: false },
        hover: { collapsible: "icon" as const, expandOnHover: true },
    }[sidebarMode];

    return (
        <Sidebar
            {...sidebarProps}
            className={className}
        >
            {children}
            {sidebarMode !== "expanded" && <SidebarRail />}
        </Sidebar>
    );
}

export default function OrganizationLayoutClient({
    children,
    params,
}: {
    children: React.ReactNode;
    params: LayoutParams;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [organization, setOrganization] = useState<OrganizationData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { isOpen, setIsOpen } = useMobileSheet();

    const isProjectRoute = pathname.includes(`/dashboard/organizations/${organization?.slug}/projects/`);

    useEffect(() => {
        const fetchOrganization = async () => {
            setError(null);
            try {
                const resolvedParams = await Promise.resolve(params);
                const { orgSlug } = resolvedParams;

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

                setOrganization(orgData);
            } catch (err: unknown) {
                console.error("Unexpected error:", (err as Error).message);
                setError("An unexpected error occurred.");
            }
        };

        fetchOrganization();
    }, [params, router]);


    if (error)
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
                <p className="text-sm text-red-500">{error}</p>
            </div>
        );

    // Don't render until we have organization data
    if (!organization) return null;

    return (
        <SidebarProvider defaultOpen>
            {/* Desktop Sidebar - hidden on mobile */}
            {!isProjectRoute && (
                <SidebarWithMode className="top-12 h-[calc(100vh-3rem)] hidden lg:block border-r border-border/40 bg-sidebar">
                    <SidebarContent>
                        <SidebarGroup className="pt-3">
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild tooltip="Projects" size="sm">
                                        <Link href={`/dashboard/organizations/${organization.slug}/projects`}>
                                            <LayersIcon animateOnHover />
                                            <span className="text-[13px]">Projects</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild tooltip="Billing" size="sm">
                                        <Link href={`/dashboard/organizations/${organization.slug}/billing`}>
                                            <PanelTopIcon animateOnHover />
                                            <span className="text-[13px]">Billing</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild tooltip="Usage" size="sm">
                                        <Link href={`/dashboard/organizations/${organization.slug}/usage`}>
                                            <ActivityIcon animateOnHover />
                                            <span className="text-[13px]">Usage</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>

                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild tooltip="Integrations" size="sm">
                                        <Link href={`/dashboard/organizations/${organization.slug}/integrations`}>
                                            <UnplugIcon animateOnHover />
                                            <span className="text-[13px]">Integrations</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild tooltip="Teams" size="sm">
                                        <Link href={`/dashboard/organizations/${organization.slug}/teams`}>
                                            <UserRoundIcon animateOnHover />
                                            <span className="text-[13px]">Teams</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild tooltip="Settings" size="sm">
                                        <Link href={`/dashboard/organizations/${organization.slug}/settings`}>
                                            <SettingsIcon animateOnHover />
                                            <span className="text-[13px]">Settings</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroup>
                    </SidebarContent>
                    <div className="absolute bottom-0 left-0 w-full p-1.5">
                        <SidebarTrigger />
                    </div>
                </SidebarWithMode>
            )}

            {/* Mobile Sheet - slides up from bottom, only visible on mobile */}
            {!isProjectRoute && (
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetContent side="bottom" className="h-[75vh]">
                        <div className="py-4">
                            <SidebarGroup>
                                <SidebarMenu>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild size="sm">
                                            <Link href={`/dashboard/organizations/${organization.slug}/projects`} onClick={() => setIsOpen(false)}>
                                                <LayersIcon animateOnHover />
                                                <span className="text-[13px]">Projects</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild size="sm">
                                            <Link href={`/dashboard/organizations/${organization.slug}/billing`} onClick={() => setIsOpen(false)}>
                                                <PanelTopIcon animateOnHover />
                                                <span className="text-[13px]">Billing</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild size="sm">
                                            <Link href={`/dashboard/organizations/${organization.slug}/usage`} onClick={() => setIsOpen(false)}>
                                                <ActivityIcon animateOnHover />
                                                <span className="text-[13px]">Usage</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>

                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild size="sm">
                                            <Link href={`/dashboard/organizations/${organization.slug}/integrations`} onClick={() => setIsOpen(false)}>
                                                <UnplugIcon animateOnHover />
                                                <span className="text-[13px]">Integrations</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild size="sm">
                                            <Link href={`/dashboard/organizations/${organization.slug}/teams`} onClick={() => setIsOpen(false)}>
                                                <UserRoundIcon animateOnHover />
                                                <span className="text-[13px]">Teams</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton asChild size="sm">
                                            <Link href={`/dashboard/organizations/${organization.slug}/settings`} onClick={() => setIsOpen(false)}>
                                                <SettingsIcon animateOnHover />
                                                <span className="text-[13px]">Settings</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarMenu>
                            </SidebarGroup>
                        </div>
                    </SheetContent>
                </Sheet>
            )}

            <main className="flex w-full flex-1 flex-col overflow-hidden">{children}</main>
        </SidebarProvider>
    );
}

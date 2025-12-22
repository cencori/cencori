"use client";

import React, { use } from "react";
import { notFound, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
    SidebarMenuSkeleton,
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
import { prefetchHelpers } from "@/components/PrefetchLink";

interface OrganizationData {
    id: string;
    name: string;
    slug: string;
}

type LayoutParams = { orgSlug: string } | Promise<{ orgSlug: string }>;

// Hook to fetch organization with caching
function useOrganizationLayout(orgSlug: string) {
    return useQuery({
        queryKey: ["organizationLayout", orgSlug],
        queryFn: async () => {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) throw new Error("Not authenticated");

            const { data: orgData, error: orgError } = await supabase
                .from("organizations")
                .select("id, name, slug")
                .eq("slug", orgSlug)
                .single();

            if (orgError || !orgData) throw new Error("Organization not found");
            return orgData as OrganizationData;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes - layout data rarely changes
    });
}

// Sidebar link with prefetching
function SidebarNavLink({
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
            // Delay prefetch slightly
            setTimeout(prefetch, 100);
        }
    };

    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={label} isActive={isActive}>
                <Link href={href} onMouseEnter={handleMouseEnter} onClick={onClick}>
                    <Icon animateOnHover />
                    <span>{label}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

// Sidebar that responds to mode preference
function SidebarWithMode({
    children,
    className,
    showRail = true,
}: {
    children: React.ReactNode;
    className?: string;
    showRail?: boolean;
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

    // Don't show rail in expanded mode
    const shouldShowRail = showRail && sidebarMode !== "expanded";

    return (
        <Sidebar
            collapsible={sidebarProps.collapsible}
            expandOnHover={sidebarProps.expandOnHover}
            className={className}
        >
            {children}
            {shouldShowRail && <SidebarRail />}
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
    // Handle both Promise and regular params
    const resolvedParams = params instanceof Promise ? use(params) : params;
    const { orgSlug } = resolvedParams;

    const pathname = usePathname();
    const queryClient = useQueryClient();
    const { isOpen, setIsOpen } = useMobileSheet();

    // Fetch org with caching - INSTANT ON REVISIT!
    const { data: organization, isLoading, error } = useOrganizationLayout(orgSlug);

    const isProjectRoute = pathname.includes(`/dashboard/organizations/${orgSlug}/projects/`) &&
        pathname !== `/dashboard/organizations/${orgSlug}/projects`;

    // Helper to check if a route is active
    const isActive = (path: string) => {
        if (path.endsWith('/projects')) {
            return pathname === path || pathname.endsWith('/projects');
        }
        return pathname.startsWith(path);
    };

    // Prefetch functions for each route
    const prefetchFunctions = organization ? {
        projects: () => prefetchHelpers.orgProjects(queryClient, orgSlug),
        billing: () => prefetchHelpers.orgBilling(queryClient, orgSlug),
        settings: () => prefetchHelpers.orgSettings(queryClient, orgSlug),
    } : {};

    if (error) {
        notFound();
    }

    if (isLoading || !organization) {
        return (
            <SidebarProvider defaultOpen={false}>
                <Sidebar collapsible="icon" className="top-12 h-[calc(100vh-3rem)] hidden lg:block border-r border-border/40 bg-sidebar">
                    <SidebarContent>
                        <SidebarGroup className="pt-3">
                            <SidebarMenu>
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <SidebarMenuSkeleton key={i} showIcon />
                                ))}
                            </SidebarMenu>
                        </SidebarGroup>
                    </SidebarContent>
                </Sidebar>
                <main className="flex w-full flex-1 flex-col overflow-hidden">{children}</main>
            </SidebarProvider>
        );
    }

    const basePath = `/dashboard/organizations/${organization.slug}`;

    const navItems = [
        { href: `${basePath}/projects`, icon: LayersIcon, label: "Projects", prefetch: prefetchFunctions.projects },
        { href: `${basePath}/billing`, icon: PanelTopIcon, label: "Billing", prefetch: prefetchFunctions.billing },
        { href: `${basePath}/usage`, icon: ActivityIcon, label: "Usage" },
        { href: `${basePath}/integrations`, icon: UnplugIcon, label: "Integrations" },
        { href: `${basePath}/teams`, icon: UserRoundIcon, label: "Teams" },
        { href: `${basePath}/settings`, icon: SettingsIcon, label: "Settings", prefetch: prefetchFunctions.settings },
    ];

    return (
        <SidebarProvider defaultOpen={false}>
            {/* Desktop Sidebar - hidden on mobile */}
            {!isProjectRoute && (
                <SidebarWithMode className="top-12 h-[calc(100vh-3rem)] hidden lg:block border-r border-border/40 bg-sidebar">
                    <SidebarContent>
                        <SidebarGroup className="pt-3">
                            <SidebarMenu>
                                {navItems.map((item) => (
                                    <SidebarNavLink
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
                                    {navItems.map((item) => (
                                        <SidebarNavLink
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
            )}

            <main className="flex w-full flex-1 flex-col overflow-hidden">{children}</main>
        </SidebarProvider>
    );
}

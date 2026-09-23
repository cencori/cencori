"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useParams, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarProvider,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarGroup,
    SidebarSeparator,
    SidebarFooter,
} from "@/components/ui/sidebar";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { Book, ArrowUpRight, HelpCircle, Wrench, Activity, Mail, FileText, Check, ChevronsUpDown, ChevronLeft, ChevronRight, Plus, Search, Command } from "lucide-react";
import DashboardCircleIcon from "@hugeicons/core-free-icons/DashboardCircleIcon";
import Analytics01Icon from "@hugeicons/core-free-icons/Analytics01Icon";
import Activity03Icon from "@hugeicons/core-free-icons/Activity03Icon";
import DiscoverSquareIcon from "@hugeicons/core-free-icons/DiscoverSquareIcon";
import AiLockIcon from "@hugeicons/core-free-icons/AiLockIcon";
import AiBrain02Icon from "@hugeicons/core-free-icons/AiBrain02Icon";
import ThreeDRotateIcon from "@hugeicons/core-free-icons/ThreeDRotateIcon";
import CreditCardAcceptIcon from "@hugeicons/core-free-icons/CreditCardAcceptIcon";
import Settings02Icon from "@hugeicons/core-free-icons/Settings02Icon";
import Configuration02Icon from "@hugeicons/core-free-icons/Configuration02Icon";
import AiChat01Icon from "@hugeicons/core-free-icons/AiChat01Icon";
import AiCloudIcon from "@hugeicons/core-free-icons/AiCloudIcon";
import AiChipIcon from "@hugeicons/core-free-icons/AiChipIcon";
import ThreeDMoveIcon from "@hugeicons/core-free-icons/ThreeDMoveIcon";
import AiSettingIcon from "@hugeicons/core-free-icons/AiSettingIcon";
import Blockchain03Icon from "@hugeicons/core-free-icons/Blockchain03Icon";
import AiChemistry01Icon from "@hugeicons/core-free-icons/AiChemistry01Icon";
import DollarCircleIcon from "@hugeicons/core-free-icons/DollarCircleIcon";
import Chart01Icon from "@hugeicons/core-free-icons/Chart01Icon";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import UserMultipleIcon from "@hugeicons/core-free-icons/UserMultipleIcon";
import DocumentValidationIcon from "@hugeicons/core-free-icons/DocumentValidationIcon";
import { useMobileSheet } from "@/lib/contexts/MobileSheetContext";
import { useSession } from "@/lib/contexts/SessionContext";
import { isAuthExpiredError } from "@/lib/auth/auth-errors";
import { WorkspaceUnavailable } from "@/components/dashboard/WorkspaceUnavailable";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { CreateProjectDialog } from "@/components/dashboard/CreateProjectDialog";
import { useCommandPalette } from "@/lib/contexts/CommandPaletteContext";
import { FeedbackMenu } from "@/components/dashboard/FeedbackMenu";
import { getConsoleRoute } from "@/lib/console/routing";
import { getMainSiteUrl } from "@/lib/main-site-url";
import { useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";
import { announceNavigationIntent } from "@/lib/navigation-intent";

interface OrganizationData {
    id: string;
    name: string;
    slug: string;
    subscription_tier: string;
}

// Sentinel message that marks an org the server returned zero rows for, vs. a
// transient failure (offline, 5xx). Only the former renders the unavailable
// screen — a network blip must never nuke the dashboard.
//
// "Zero rows" is not the same as "doesn't exist": RLS filters out every org the
// signed-in account isn't a member of, so a workspace belonging to another
// account is indistinguishable from a slug that was never real. See
// WorkspaceUnavailable for how that ambiguity is presented.
const ORG_NOT_FOUND = "ORG_NOT_FOUND";
// The session behind the tab is dead or belongs to somebody else. Handed to
// SessionProvider, which owns the interruption UI.
const ORG_AUTH_EXPIRED = "ORG_AUTH_EXPIRED";

function useOrganization(orgSlug: string) {
    return useQuery({
        queryKey: ["orgLayout", orgSlug],
        queryFn: async () => {
            const { data: orgData, error: orgError } = await supabase
                .from("organizations")
                .select("id, name, slug, subscription_tier")
                .eq("slug", orgSlug)
                .single();

            if (orgError) {
                // An expired or swapped session comes back as an auth error,
                // not as missing data. Never render that as a missing org.
                if (isAuthExpiredError(orgError)) {
                    throw new Error(ORG_AUTH_EXPIRED);
                }
                // PGRST116 = query succeeded but matched no rows → nothing this
                // account can reach at this slug. Anything else (network drop,
                // timeout, 5xx) is transient and must be surfaced as a
                // retryable error.
                if (orgError.code === "PGRST116") {
                    throw new Error(ORG_NOT_FOUND);
                }
                throw orgError;
            }
            if (!orgData) {
                throw new Error(ORG_NOT_FOUND);
            }

            return orgData as OrganizationData;
        },
        staleTime: 15 * 60 * 1000,
        // Retrying a definitive answer only delays the explanation. Transient
        // failures keep the default single retry.
        retry: (failureCount, error) => {
            const message = error instanceof Error ? error.message : "";
            if (message === ORG_NOT_FOUND || message === ORG_AUTH_EXPIRED) return false;
            return failureCount < 1;
        },
    });
}

export default function OrganizationLayoutClient({
    children,
    workspace,
    consoleMode: consoleModeOverride = false,
}: {
    children: React.ReactNode;
    consoleMode?: boolean;
    workspace?: {
        orgSlug: string;
        projectSlug: string;
        consoleMode?: boolean;
    };
}) {
    const params = useParams<{ orgSlug?: string; projectSlug?: string }>();
    const orgSlug = workspace?.orgSlug ?? params.orgSlug ?? "";
    const routeProjectSlug = workspace?.projectSlug ?? params.projectSlug ?? null;
    const consoleMode = workspace?.consoleMode === true || consoleModeOverride;
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchParamsKey = searchParams.toString();
    const { isOpen, setIsOpen } = useMobileSheet();
    const { reportSessionExpired } = useSession();
    const {
        projects: workspaceProjects,
        activeProject,
        selectProject,
        loading: workspaceLoading,
    } = useOrganizationProject();
    const { data: organization, error } = useOrganization(orgSlug);

    const { data: projects } = useQuery({
        queryKey: ["sidebarProjects", organization?.id],
        queryFn: async () => {
            if (!organization?.id) return [];
            const { data } = await supabase
                .from("projects")
                .select("slug")
                .eq("organization_id", organization.id)
                .limit(1);
            return data || [];
        },
        enabled: !!organization?.id,
        staleTime: 15 * 60 * 1000,
        placeholderData: (prev: { slug: string }[] | undefined) => prev,
    });

    // URL shape after the polish is /{orgSlug}/{projectSlug OR ~}/*.
    // Everything at segments[1] except "~" is a project slug — every
    // org-scoped route lives under /{orgSlug}/~/*.
    const router = useRouter();
    const segments = useMemo(() => pathname.split("/").filter(Boolean), [pathname]);
    const orgSubSegment = segments[1];
    const consoleRoute = useMemo(
        () => consoleMode ? getConsoleRoute(pathname) : null,
        [consoleMode, pathname],
    );
    // On the console host, the visible flat URL is the source of truth for
    // scope. In particular, /organization/settings must not be inferred as a
    // project route merely because "settings" is the second path segment.
    const isInsideProject = consoleRoute
        ? consoleRoute.scope === "project"
        : Boolean(routeProjectSlug) || (!!orgSubSegment && orgSubSegment !== "~");
    const projectSlug = routeProjectSlug ?? (isInsideProject ? orgSubSegment : (projects?.[0]?.slug || null));
    const availableProjects = workspaceProjects.filter((project) =>
        project.orgSlug === orgSlug || project.organization_id === organization?.id
    );
    const selectedProject = (
        activeProject && availableProjects.some((project) => project.id === activeProject.id)
            ? activeProject
            : availableProjects.find((project) => project.slug === projectSlug)
    ) ?? availableProjects[0] ?? null;
    // While the workspace is still resolving (cold load, console context fetch)
    // the header shows an explicit loading state instead of blank space.
    const headerResolving = consoleMode
        ? workspaceLoading && !activeProject
        : !selectedProject && workspaceLoading;
    const headerProjectLabel = selectedProject?.name || projectSlug || "Select project";
    const isProjectCreation = pathname.includes("/projects/new") || pathname.includes("/projects/import");
    const isPlayground = pathname.includes("/ai-gateway/playground");
    const isEmbeddedAgents = pathname === "/agents" || pathname.endsWith("/agents");
    const isFixedWorkspace = isPlayground || isEmbeddedAgents;
    const docsUrl = getMainSiteUrl("/docs");
    const scopedArea = segments[2];
    const isProjectSettingsView = isInsideProject && (
        consoleMode ? pathname === "/settings" : scopedArea === "settings"
    );
    const isOrganizationSettingsView = !isInsideProject && (
        consoleMode ? pathname === "/organization/settings" : scopedArea === "settings"
    );
    const [activeView, setActiveView] = useState<"main" | "observability" | "ai-gateway" | "project-settings" | "settings">(() => {
        if (pathname.includes("/observability")) return "observability";
        if (pathname.includes("/ai-gateway")) return "ai-gateway";
        if (isProjectSettingsView) return "project-settings";
        if (isOrganizationSettingsView) return "settings";
        return "main";
    });
    const [pendingSubnavEntry, setPendingSubnavEntry] = useState<Exclude<typeof activeView, "main"> | null>(null);
    const [createProjectOpen, setCreateProjectOpen] = useState(false);
    const { setOpen: setCommandPaletteOpen } = useCommandPalette();

    const orgBase = `/${orgSlug}`;
    const basePath = projectSlug ? `${orgBase}/${projectSlug}` : null;
    // Sticky project scope: once a project is known (URL on slug hosts,
    // console context on console hosts, last-visited on reloads), the project
    // section keeps pointing at it even from organization pages. Moving from
    // Overview to Billing must not turn that section into an organization
    // directory or discard the selected project.
    useEffect(() => {
        if (routeProjectSlug && orgSlug) {
            try {
                localStorage.setItem(`cencori:last-project:${orgSlug}`, routeProjectSlug);
            } catch { /* storage unavailable, ignore */ }
        }
    }, [routeProjectSlug, orgSlug]);
    const stickyProjectSlug = useMemo(() => {
        if (consoleMode) return activeProject?.slug ?? null;
        if (routeProjectSlug) return routeProjectSlug;
        if (!orgSlug || typeof window === "undefined") return null;
        try {
            return localStorage.getItem(`cencori:last-project:${orgSlug}`);
        } catch {
            return null;
        }
    }, [consoleMode, activeProject, routeProjectSlug, orgSlug]);
    const scopeProjectSlug = isInsideProject ? projectSlug : stickyProjectSlug;
    const scopedProjectHref = (subpath: string) =>
        consoleMode ? `/${subpath}` : `${orgBase}/${scopeProjectSlug}${subpath}`;
    const orgProductHref = (subpath: string) =>
        consoleMode ? `/organization/${subpath}` : `${orgBase}/~/${subpath}`;
    const observabilityHref = scopeProjectSlug
        ? scopedProjectHref("observability")
        : orgProductHref("observability");
    const aiGatewayHref = scopeProjectSlug ? scopedProjectHref("ai-gateway") : orgProductHref("ai-gateway");
    // The sidebar Settings entry has one stable meaning: settings for the
    // selected project. Organization settings are entered deliberately from
    // the user menu instead of changing this destination based on the page the
    // user happens to be viewing.
    const settingsHref = consoleMode
        ? "/settings"
        : (scopeProjectSlug ? `${orgBase}/${scopeProjectSlug}/settings` : `${orgBase}/~/projects`);
    const rawObservabilitySection = pathname.includes("/observability")
        ? searchParams.get("section")
        : null;
    const observabilitySection = pendingSubnavEntry === "observability"
        ? "overview"
        : rawObservabilitySection === "http" || rawObservabilitySection === "api" || rawObservabilitySection === "web"
        ? "overview"
        : rawObservabilitySection || "overview";
    const organizationSettingsSection = pendingSubnavEntry === "settings"
        ? "general"
        : searchParams.get("section") === "advanced" ? "advanced" : "general";
    const requestedProjectSettingsTab = searchParams.get("tab");
    const projectSettingsTab = pendingSubnavEntry === "project-settings"
        ? "general"
        : ["general", "budget", "providers", "infrastructure", "networking", "integrations", "api", "webhooks"].includes(requestedProjectSettingsTab || "")
        ? requestedProjectSettingsTab
        : "general";

    const isActive = (path: string) => {
        const exactMatchOnly =
            path === basePath ||
            path === orgBase ||
            path === "/home" ||
            path === "/ai-gateway" ||
            path === "/organization/ai-gateway" ||
            path === `${basePath}/ai-gateway` ||
            path === `${orgBase}/~/ai-gateway`;
        if (exactMatchOnly) return pathname === path;
        if (pathname === path) return true;
        if (pathname.startsWith(path + "/")) return true;
        return false;
    };

    const prefetchRoute = (href: string) => {
        router.prefetch(href);
    };

    const handleSidebarNavigationCapture = (event: React.MouseEvent<HTMLElement>) => {
        if (
            event.button !== 0
            || event.metaKey
            || event.ctrlKey
            || event.shiftKey
            || event.altKey
        ) return;

        const target = event.target;
        if (!(target instanceof Element)) return;

        const link = target.closest<HTMLAnchorElement>("a[href]");
        if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

        const destination = new URL(link.href, window.location.href);
        if (destination.origin !== window.location.origin) return;

        const currentLocation = `${window.location.pathname}${window.location.search}`;
        const nextLocation = `${destination.pathname}${destination.search}`;
        if (currentLocation === nextLocation) return;

        announceNavigationIntent(nextLocation);
    };

    const queryClient = useQueryClient();
    useEffect(() => {
        queryClient.prefetchQuery({ queryKey: ["orgLayout", orgSlug] });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setPendingSubnavEntry(null);
        if (pathname.includes("/observability")) {
            setActiveView("observability");
        } else if (pathname.includes("/ai-gateway")) {
            setActiveView("ai-gateway");
        } else if (isProjectSettingsView) {
            setActiveView("project-settings");
        } else if (isOrganizationSettingsView) {
            setActiveView("settings");
        } else {
            setActiveView("main");
        }
    }, [isInsideProject, isOrganizationSettingsView, isProjectSettingsView, pathname, searchParamsKey]);

    // These entries also switch the sidebar into a nested navigation mode.
    // Warm their default pages while the shell is idle so one click can reveal
    // the submenu and its Overview/General page as a single, immediate action.
    useEffect(() => {
        router.prefetch(observabilityHref);
        router.prefetch(aiGatewayHref);
        router.prefetch(settingsHref);
    }, [aiGatewayHref, observabilityHref, router, settingsHref]);

    // Transient/network errors keep the last-good dashboard on screen; the
    // global ConnectivityWatcher tells the user to reconnect, and React Query
    // refetches once back online. Only a definitive answer changes the page.
    const orgErrorMessage = error instanceof Error ? error.message : null;

    useEffect(() => {
        if (orgErrorMessage === ORG_AUTH_EXPIRED) {
            reportSessionExpired();
        }
    }, [orgErrorMessage, reportSessionExpired]);

    if (orgErrorMessage === ORG_NOT_FOUND) {
        // Deliberately not notFound(): the sidebar around it links into an org
        // this account can't open, and "404" answers the wrong question. See
        // WorkspaceUnavailable.
        return <WorkspaceUnavailable orgSlug={orgSlug} />;
    }

    // Layout groups (top → bottom):
    //   1. overviewItem                  — selected project's Overview
    //   2. Observability toggle           — expands to observabilitySubItems
    //   3. projectItems                  — Logs
    //   4. AI Gateway toggle             — expands to projectSubItems
    //   5. projectSecondaryItems         — Security, Memory, Deployments, Monetization
    //   6. orgItems                      — Billing, Usage, Teams, Audit Log
    //   7. bottomItems                   — Settings (fixed final position in every scope)

    const overviewItem = {
        href: consoleMode
            ? "/home"
            : (scopeProjectSlug ? `${orgBase}/${scopeProjectSlug}` : `${orgBase}/~/projects`),
        icon: <HugeiconsIcon icon={DashboardCircleIcon} className="!h-5 !w-5" />,
        label: "Overview",
    };

    const observabilityItem = {
        href: observabilityHref,
        icon: <HugeiconsIcon icon={Analytics01Icon} className="!h-5 !w-5" />,
        label: "Observability",
    };

    const projectItems = [
        {
            href: scopeProjectSlug ? scopedProjectHref("logs") : orgProductHref("logs"),
            icon: <HugeiconsIcon icon={Activity03Icon} className="!h-5 !w-5" />,
            label: "Logs",
        },
    ];

    const observabilitySubItems = [
        { section: "overview", href: observabilityHref, icon: <HugeiconsIcon icon={DashboardCircleIcon} className="!h-5 !w-5" />, label: "Overview" },
        { section: "ai", href: `${observabilityHref}?section=ai`, icon: <HugeiconsIcon icon={AiChipIcon} className="!h-5 !w-5" />, label: "AI" },
        { section: "reliability", href: `${observabilityHref}?section=reliability`, icon: <HugeiconsIcon icon={Activity03Icon} className="!h-5 !w-5" />, label: "Reliability" },
        { section: "security", href: `${observabilityHref}?section=security`, icon: <HugeiconsIcon icon={AiLockIcon} className="!h-5 !w-5" />, label: "Security" },
        { section: "intelligence", href: `${observabilityHref}?section=intelligence`, icon: <HugeiconsIcon icon={AiChemistry01Icon} className="!h-5 !w-5" />, label: "Intelligence" },
    ];

    const projectSubItems = [
        { href: aiGatewayHref, icon: <HugeiconsIcon icon={DashboardCircleIcon} className="!h-5 !w-5" />, label: "Overview" },
        { href: scopeProjectSlug ? scopedProjectHref("ai-gateway/prompts") : orgProductHref("ai-gateway/prompts"), icon: <HugeiconsIcon icon={AiChat01Icon} className="!h-5 !w-5" />, label: "Prompts" },
        { href: scopeProjectSlug ? scopedProjectHref("ai-gateway/providers") : orgProductHref("ai-gateway/providers"), icon: <HugeiconsIcon icon={AiCloudIcon} className="!h-5 !w-5" />, label: "BYOK" },
        { href: scopeProjectSlug ? scopedProjectHref("ai-gateway/models") : orgProductHref("ai-gateway/models"), icon: <HugeiconsIcon icon={AiChipIcon} className="!h-5 !w-5" />, label: "Models" },
        { href: scopeProjectSlug ? scopedProjectHref("ai-gateway/custom-providers") : orgProductHref("ai-gateway/custom-providers"), icon: <HugeiconsIcon icon={AiSettingIcon} className="!h-5 !w-5" />, label: "Custom Providers" },
        { href: scopeProjectSlug ? scopedProjectHref("ai-gateway/cache") : orgProductHref("ai-gateway/cache"), icon: <HugeiconsIcon icon={Blockchain03Icon} className="!h-5 !w-5" />, label: "Cache" },
        { href: scopeProjectSlug ? scopedProjectHref("ai-gateway/playground") : orgProductHref("ai-gateway/playground"), icon: <HugeiconsIcon icon={AiChemistry01Icon} className="!h-5 !w-5" />, label: "Playground" },
    ];

    const projectSecondaryItems = [
        { href: scopeProjectSlug ? scopedProjectHref("security") : orgProductHref("security"), icon: <HugeiconsIcon icon={AiLockIcon} className="!h-5 !w-5" />, label: "Security" },
        // Memory belongs to the selected project, so keep it available while an
        // organization-level page is open instead of reshaping the sidebar.
        ...(scopeProjectSlug && process.env.NODE_ENV !== "production"
            ? [{ href: consoleMode ? "/memory" : `${orgBase}/${scopeProjectSlug}/memory`, icon: <HugeiconsIcon icon={AiBrain02Icon} className="!h-5 !w-5" />, label: "Memory" }]
            : []),
        // Deployments stays attached to the selected project for the same stable
        // project → organization → project navigation model.
        ...(process.env.NODE_ENV !== "production"
            ? [{ href: scopeProjectSlug ? scopedProjectHref("deployments") : orgProductHref("deployments"), icon: <HugeiconsIcon icon={ThreeDMoveIcon} className="!h-5 !w-5" />, label: "Deployments" }]
            : []),
        { href: scopeProjectSlug ? scopedProjectHref("monetization") : orgProductHref("monetization"), icon: <HugeiconsIcon icon={CreditCardAcceptIcon} className="!h-5 !w-5" />, label: "Monetization" },
        { href: scopeProjectSlug ? scopedProjectHref("agents") : orgProductHref("agents"), icon: <HugeiconsIcon icon={ThreeDRotateIcon} className="!h-5 !w-5" />, label: "Agents" },
    ];

    const orgItems = [
        { href: consoleMode ? "/billing" : `${orgBase}/~/billing`, icon: <HugeiconsIcon icon={DollarCircleIcon} className="!h-5 !w-5" />, label: "Billing" },
        { href: consoleMode ? "/usage" : `${orgBase}/~/usage`, icon: <HugeiconsIcon icon={Chart01Icon} className="!h-5 !w-5" />, label: "Usage" },
        { href: consoleMode ? "/teams" : `${orgBase}/~/teams`, icon: <HugeiconsIcon icon={UserMultipleIcon} className="!h-5 !w-5" />, label: "Teams" },
        { href: consoleMode ? "/audit-log" : `${orgBase}/~/audit-log`, icon: <HugeiconsIcon icon={DocumentValidationIcon} className="!h-5 !w-5" />, label: "Audit Log" },
        { href: consoleMode ? "/governance" : `${orgBase}/~/governance`, icon: <HugeiconsIcon icon={AiLockIcon} className="!h-5 !w-5" />, label: "Governance" },
    ];

    const bottomItems = [
        { href: settingsHref, icon: <HugeiconsIcon icon={Settings02Icon} className="!h-5 !w-5" />, label: "Settings" },
    ];

    const organizationSettingsItems = [
        { section: "general", href: consoleMode ? "/organization/settings" : `${orgBase}/~/settings`, icon: <HugeiconsIcon icon={Settings02Icon} className="!h-5 !w-5" />, label: "General" },
        { section: "advanced", href: consoleMode ? "/organization/settings?section=advanced" : `${orgBase}/~/settings?section=advanced`, icon: <HugeiconsIcon icon={Configuration02Icon} className="!h-5 !w-5" />, label: "Advanced" },
    ];

    const projectSettingsItems = [
        { tab: "general", href: settingsHref, label: "General" },
        { tab: "budget", href: `${settingsHref}?tab=budget`, label: "Budget" },
        { tab: "providers", href: `${settingsHref}?tab=providers`, label: "Providers" },
        { tab: "infrastructure", href: `${settingsHref}?tab=infrastructure`, label: "Infrastructure" },
        { tab: "networking", href: `${settingsHref}?tab=networking`, label: "Networking" },
        { tab: "integrations", href: `${settingsHref}?tab=integrations`, label: "Integrations" },
        { tab: "api", href: `${settingsHref}?tab=api`, label: "API" },
        { tab: "webhooks", href: `${settingsHref}?tab=webhooks`, label: "Webhooks" },
    ];

    const renderBottomItems = () => bottomItems.map((item) => {
        const isSettingsItem = item.label === "Settings";

        return (
            <SidebarMenuItem key={item.href}>
                {isSettingsItem ? (
                    <SidebarMenuButton
                        asChild
                        isActive={isProjectSettingsView}
                        size="sm"
                        className="gap-1"
                    >
                        <Link
                            href={item.href}
                            prefetch={true}
                            onClick={() => {
                                setPendingSubnavEntry("project-settings");
                                setActiveView("project-settings");
                            }}
                            onMouseEnter={() => prefetchRoute(item.href)}
                        >
                            {item.icon}
                            <span className="text-sm">{item.label}</span>
                            <ChevronRight className="!h-3 !w-3 ml-auto text-muted-foreground/50" />
                        </Link>
                    </SidebarMenuButton>
                ) : (
                    <SidebarMenuButton asChild tooltip={item.label} isActive={isActive(item.href)} size="sm">
                        <Link href={item.href} prefetch={true} onMouseEnter={() => prefetchRoute(item.href)}>
                            {item.icon}
                            <span className="text-sm">{item.label}</span>
                        </Link>
                    </SidebarMenuButton>
                )}
            </SidebarMenuItem>
        );
    });

    return (
        <SidebarProvider
            defaultOpen
            className={isFixedWorkspace ? "h-full min-h-0 overflow-hidden" : undefined}
        >
            {!isProjectCreation && (
                <Sidebar
                    className="top-0 hidden h-svh border-r border-sidebar-border/70 bg-sidebar lg:block"
                    onClickCapture={handleSidebarNavigationCapture}
                >
                    <SidebarHeader className="h-12 shrink-0 justify-center p-1.5">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-medium text-foreground hover:bg-sidebar-accent"
                                    aria-label="Select project"
                                    aria-busy={headerResolving}
                                    disabled={headerResolving}
                                >
                                    <span className="min-w-0 flex-1 truncate">
                                        {headerResolving ? "Loading project" : headerProjectLabel}
                                    </span>
                                    {headerResolving ? (
                                        <HugeiconsIcon icon={Loading03Icon} className="size-4 shrink-0 animate-spin text-foreground/80" />
                                    ) : (
                                        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground/60" />
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="bottom"
                                align="start"
                                sideOffset={5}
                                className="z-[70] w-64 rounded-xl !border-0 !bg-[#f3f3f1] p-1 shadow-[0_18px_48px_rgba(0,0,0,0.35)] data-[state=closed]:!animate-none data-[state=open]:!animate-none dark:!bg-[#181818]"
                            >
                                <p className="px-3 pb-1 pt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                    Projects
                                </p>
                                <div className="max-h-52 overflow-y-auto">
                                    {availableProjects.map((project) => (
                                        <DropdownMenuItem
                                            key={project.id}
                                            className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px] font-medium"
                                            onClick={async () => {
                                                if (consoleMode && await selectProject(project.id)) {
                                                    if (!isInsideProject) router.push("/home");
                                                    router.refresh();
                                                    return;
                                                }
                                                router.push(`/${orgSlug}/${project.slug}`);
                                            }}
                                        >
                                            <span className="min-w-0 flex-1 truncate">{project.name}</span>
                                            {project.id === selectedProject?.id && (
                                                <Check className="ml-auto size-4 shrink-0" />
                                            )}
                                        </DropdownMenuItem>
                                    ))}
                                    {availableProjects.length === 0 && (
                                        <p className="px-3 py-3 text-xs text-muted-foreground">No projects yet.</p>
                                    )}
                                </div>
                                <DropdownMenuSeparator className="-mx-1 my-1 bg-border/35" />
                                <DropdownMenuItem
                                    className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px]"
                                    onSelect={() => setCreateProjectOpen(true)}
                                >
                                    <span className="min-w-0 flex-1 truncate">Create project</span>
                                    <Plus className="ml-auto size-4 shrink-0" />
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px]"
                                    onClick={() => router.push(consoleMode ? "/projects" : `/${orgSlug}/~/projects`)}
                                >
                                    <span className="min-w-0 flex-1 truncate">Manage projects</span>
                                    <HugeiconsIcon icon={Settings02Icon} className="ml-auto !size-4 shrink-0" />
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarHeader>
                    <SidebarContent>
                        <SidebarGroup className="pt-3">
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        size="sm"
                                        tooltip="Search"
                                        onClick={() => setCommandPaletteOpen(true)}
                                        className="bg-[#f3f3f1] text-muted-foreground dark:bg-[#181818]"
                                    >
                                        <Search className="!h-4 !w-4" />
                                        <span className="text-sm">Search</span>
                                        <span className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                                            <Command className="h-2.5 w-2.5" />K
                                        </span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                {activeView === "observability" ? (
                                    <>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                onClick={() => setActiveView("main")}
                                                size="sm"
                                                className="gap-1 text-muted-foreground"
                                            >
                                                <ChevronLeft className="!h-5 !w-5" />
                                                <span className="text-sm">Back</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        {observabilitySubItems.map((item) => (
                                            <SidebarMenuItem key={item.section}>
                                                <SidebarMenuButton
                                                    asChild
                                                    tooltip={item.label}
                                                    isActive={observabilitySection === item.section}
                                                    size="sm"
                                                >
                                                    <Link href={item.href} prefetch={true} onMouseEnter={() => prefetchRoute(item.href)}>
                                                        {item.icon}
                                                        <span className="text-sm">{item.label}</span>
                                                    </Link>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
                                    </>
                                ) : activeView === "ai-gateway" ? (
                                    <>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                onClick={() => setActiveView("main")}
                                                size="sm"
                                                className="gap-1 text-muted-foreground"
                                            >
                                                <ChevronLeft className="!h-5 !w-5" />
                                                <span className="text-sm">Back</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        {projectSubItems.map((item) => (
                                            <SidebarMenuItem key={item.href}>
                                                <SidebarMenuButton
                                                    asChild
                                                    tooltip={item.label}
                                                    isActive={isActive(item.href) || (
                                                        pendingSubnavEntry === "ai-gateway"
                                                        && item.href === aiGatewayHref
                                                    )}
                                                    size="sm"
                                                >
                                                    <Link href={item.href} prefetch={true} onMouseEnter={() => prefetchRoute(item.href)}>
                                                        {item.icon}
                                                        <span className="text-sm">{item.label}</span>
                                                    </Link>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
                                    </>
                                ) : activeView === "project-settings" ? (
                                    <>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                onClick={() => setActiveView("main")}
                                                size="sm"
                                                className="gap-1 text-muted-foreground"
                                            >
                                                <ChevronLeft className="!h-5 !w-5" />
                                                <span className="text-sm">Back</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        {projectSettingsItems.map((item) => (
                                            <SidebarMenuItem key={item.tab}>
                                                <SidebarMenuButton
                                                    asChild
                                                    tooltip={item.label}
                                                    isActive={projectSettingsTab === item.tab}
                                                    size="sm"
                                                >
                                                    <Link href={item.href} prefetch={true} onMouseEnter={() => prefetchRoute(item.href)}>
                                                        <span className="text-sm">{item.label}</span>
                                                    </Link>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
                                    </>
                                ) : activeView === "settings" ? (
                                    <>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                onClick={() => setActiveView("main")}
                                                size="sm"
                                                className="gap-1 text-muted-foreground"
                                            >
                                                <ChevronLeft className="!h-5 !w-5" />
                                                <span className="text-sm">Back</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        {organizationSettingsItems.map((item) => (
                                            <SidebarMenuItem key={item.section}>
                                                <SidebarMenuButton
                                                    asChild
                                                    tooltip={item.label}
                                                    isActive={organizationSettingsSection === item.section}
                                                    size="sm"
                                                >
                                                    <Link href={item.href} prefetch={true} onMouseEnter={() => prefetchRoute(item.href)}>
                                                        {item.icon}
                                                        <span className="text-sm">{item.label}</span>
                                                    </Link>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        {/* 1. Project Overview */}
                                        <SidebarMenuItem>
                                            <SidebarMenuButton asChild tooltip={overviewItem.label} isActive={isActive(overviewItem.href)} size="sm">
                                                <Link href={overviewItem.href} prefetch={true} onMouseEnter={() => prefetchRoute(overviewItem.href)}>
                                                    {overviewItem.icon}
                                                    <span className="text-sm">{overviewItem.label}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        {/* 2. Observability */}
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={isActive(observabilityHref)}
                                                size="sm"
                                                className="gap-1"
                                            >
                                                <Link
                                                    href={observabilityHref}
                                                    prefetch={true}
                                                    onClick={() => {
                                                        setPendingSubnavEntry("observability");
                                                        setActiveView("observability");
                                                    }}
                                                    onMouseEnter={() => prefetchRoute(observabilityHref)}
                                                >
                                                    {observabilityItem.icon}
                                                    <span className="text-sm">{observabilityItem.label}</span>
                                                    <ChevronRight className="!h-3 !w-3 ml-auto text-muted-foreground/50" />
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        {/* 3. Logs */}
                                        {projectItems.map((item) => (
                                            <SidebarMenuItem key={item.href}>
                                                <SidebarMenuButton asChild tooltip={item.label} isActive={isActive(item.href)} size="sm">
                                                    <Link href={item.href} prefetch={true} onMouseEnter={() => prefetchRoute(item.href)}>
                                                        {item.icon}
                                                        <span className="text-sm">{item.label}</span>
                                                    </Link>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
                                        {/* 4. AI Gateway toggle */}
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={isActive(aiGatewayHref)}
                                                size="sm"
                                                className="gap-1"
                                            >
                                                <Link
                                                    href={aiGatewayHref}
                                                    prefetch={true}
                                                    onClick={() => {
                                                        setPendingSubnavEntry("ai-gateway");
                                                        setActiveView("ai-gateway");
                                                    }}
                                                    onMouseEnter={() => prefetchRoute(aiGatewayHref)}
                                                >
                                                    <HugeiconsIcon icon={DiscoverSquareIcon} className="!h-5 !w-5" />
                                                    <span className="text-sm">AI Gateway</span>
                                                    <ChevronRight className="!h-3 !w-3 ml-auto text-muted-foreground/50" />
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        {/* 5. Security, Deployments, Monetization */}
                                        {projectSecondaryItems.map((item) => (
                                            <SidebarMenuItem key={item.href}>
                                                <SidebarMenuButton asChild tooltip={item.label} isActive={isActive(item.href)} size="sm">
                                                    <Link href={item.href} prefetch={true} onMouseEnter={() => prefetchRoute(item.href)}>
                                                        {item.icon}
                                                        <span className="text-sm">{item.label}</span>
                                                    </Link>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
                                        <SidebarSeparator className="my-2 mx-0 w-full" />
                                        {/* 6. Billing, Usage, Teams, Audit Log */}
                                        {orgItems.map((item) => (
                                            <SidebarMenuItem key={item.href}>
                                                <SidebarMenuButton asChild tooltip={item.label} isActive={isActive(item.href)} size="sm">
                                                    <Link href={item.href} prefetch={true} onMouseEnter={() => prefetchRoute(item.href)}>
                                                        {item.icon}
                                                        <span className="text-sm">{item.label}</span>
                                                    </Link>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
                                        <SidebarSeparator className="my-2 mx-0 w-full" />
                                        {renderBottomItems()}
                                    </>
                                )}
                            </SidebarMenu>
                        </SidebarGroup>
                    </SidebarContent>
                    <SidebarFooter className="pt-1 space-y-0.5">
                        <Link
                            href={docsUrl}
                            target="_blank"
                            className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors outline-hidden"
                        >
                            <Book className="size-3.5 shrink-0" />
                            <span className="flex-1">Documentation</span>
                            <ArrowUpRight className="size-3 shrink-0" />
                        </Link>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors outline-hidden"
                                >
                                    <HelpCircle className="size-3.5 shrink-0" />
                                    <span className="flex-1">Help & Resources</span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" side="top" sideOffset={4} className="w-80 max-h-none overflow-visible !border-0 !bg-[#101010] p-1 font-mono shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
                                <DropdownMenuItem asChild className="text-sm py-1.5 cursor-pointer">
                                    <Link href={getMainSiteUrl("/docs/troubleshooting")} className="flex justify-between w-full items-center">
                                        Troubleshooting
                                        <Wrench className="h-3.5 w-3.5 shrink-0" />
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="text-sm py-1.5 cursor-pointer">
                                    <Link href="/changelog" className="flex justify-between w-full items-center">
                                        Changelog
                                        <FileText className="h-3.5 w-3.5 shrink-0" />
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="text-sm py-1.5 cursor-pointer">
                                    <Link href="/status" className="flex justify-between w-full items-center">
                                        Cencori status
                                        <Activity className="h-3.5 w-3.5 shrink-0" />
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="text-sm py-1.5 cursor-pointer">
                                    <Link href="mailto:support@cencori.com" className="flex justify-between w-full items-center">
                                        Contact support
                                        <Mail className="h-3.5 w-3.5 shrink-0" />
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1" />
                                <div className="px-2 py-2">
                                    <p className="text-sm font-medium mb-1">Community support</p>
                                    <p className="text-[10px] text-muted-foreground mb-2">Our Discord community can help with code-related issues.</p>
                                    <Link
                                        href="https://cencori.com/discord"
                                        target="_blank"
                                        className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" color="currentColor" fill="none" stroke="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round" className="shrink-0">
                                            <path d="M15.5 17.5C16.5 19 17.3333 19.6667 18 20C19.3333 19.6667 22 18.2 22 15C22 11.8 20.6667 7.33333 20 5.5C18 4.3 15.8333 4 15 4L14.198 5.60393C13.4135 5.28708 12.4058 5.25438 12 5.27763C11.5942 5.25438 10.5865 5.28708 9.80197 5.60393L9 4C8.16667 4 6 4.3 4 5.5C3.33333 7.33333 2 11.8 2 15C2 18.2 4.66667 19.6667 6 20C6.66667 19.6667 7.5 19 8.5 17.5"></path>
                                            <path d="M17.3652 11.5C17.3652 12.6046 16.5817 13.5 15.6152 13.5C14.6487 13.5 13.8652 12.6046 13.8652 11.5C13.8652 10.3954 14.6487 9.5 15.6152 9.5C16.5817 9.5 17.3652 10.3954 17.3652 11.5Z"></path>
                                            <path d="M10 11.5C10 12.6046 9.2165 13.5 8.25 13.5C7.2835 13.5 6.5 12.6046 6.5 11.5C6.5 10.3954 7.2835 9.5 8.25 9.5C9.2165 9.5 10 10.3954 10 11.5Z"></path>
                                            <path d="M17.5 16.5C16.4022 17.3967 14.3502 18 12 18C9.64981 18 7.59785 17.3967 6.5 16.5"></path>
                                        </svg>
                                        Join us on Discord
                                    </Link>
                                    <div className="mt-2 -mx-2 -mb-2 rounded-b-md overflow-hidden">
                                        <img src="/dbanner.png" alt="Discord banner" className="w-full h-auto" />
                                    </div>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <FeedbackMenu />
                        <UserMenu
                            organization={organization ? {
                                id: organization.id,
                                name: organization.name,
                                slug: organization.slug,
                                subscriptionTier: organization.subscription_tier,
                            } : undefined}
                        />
                    </SidebarFooter>
                </Sidebar>
            )}

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetContent
                    side="bottom"
                    className="h-[70vh]"
                    onClickCapture={handleSidebarNavigationCapture}
                >
                    <div className="py-3">
                        <SidebarGroup>
                            <SidebarMenu>
                                {[
                                    overviewItem,
                                    observabilityItem,
                                    ...projectItems,
                                    ...projectSecondaryItems,
                                    ...orgItems,
                                    ...bottomItems,
                                ].map((item) => (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton asChild size="sm" onClick={() => setIsOpen(false)}>
                                            <Link href={item.href} prefetch={true}>
                                                {item.icon}
                                                <span className="text-sm">{item.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroup>
                    </div>
                </SheetContent>
            </Sheet>

            <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                <div
                    key={pathname}
                    className={isFixedWorkspace
                        ? "flex min-h-0 flex-1 flex-col overflow-hidden animate-fade-in"
                        : "animate-fade-in"
                    }
                    style={{ animationDuration: "150ms" }}
                >
                    {children}
                </div>
            </main>

            <CreateProjectDialog
                open={createProjectOpen}
                onOpenChange={setCreateProjectOpen}
                orgId={organization?.id}
                orgSlug={orgSlug}
                orgName={organization?.name}
                subscriptionTier={organization?.subscription_tier}
                consoleMode={consoleMode}
            />
        </SidebarProvider>
    );
}

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
import { Book, ArrowUpRight, HelpCircle, Wrench, Activity, Mail, FileText, ChevronsUpDown, ChevronLeft, ChevronRight, Search, Command } from "lucide-react";
import DashboardCircleIcon from "@hugeicons/core-free-icons/DashboardCircleIcon";
import DiscoverSquareIcon from "@hugeicons/core-free-icons/DiscoverSquareIcon";
import BrainIcon from "@hugeicons/core-free-icons/BrainIcon";
import AirdropIcon from "@hugeicons/core-free-icons/AirdropIcon";
import { CopilotRecentChats } from "@/components/copilot/CopilotRecentChats";
import { AgentSubnav } from "@/components/agents/AgentSubnav";
import PlusSignIcon from "@hugeicons/core-free-icons/PlusSignIcon";
import { COPILOT_CONVERSATION_COOKIE, COPILOT_NEW_CHAT_EVENT } from "@/lib/console/copilot";
import ChartRelationshipIcon from "@hugeicons/core-free-icons/ChartRelationshipIcon";
import ThreeDRotateIcon from "@hugeicons/core-free-icons/ThreeDRotateIcon";
import Settings02Icon from "@hugeicons/core-free-icons/Settings02Icon";
import ThreeDMoveIcon from "@hugeicons/core-free-icons/ThreeDMoveIcon";
import GameController03Icon from "@hugeicons/core-free-icons/GameController03Icon";
import LeftToRightListDashIcon from "@hugeicons/core-free-icons/LeftToRightListDashIcon";
import KeySquareIcon from "@hugeicons/core-free-icons/KeySquareIcon";
import BadgeDollarSignIcon from "@hugeicons/core-free-icons/BadgeDollarSignIcon";
import Blockchain01Icon from "@hugeicons/core-free-icons/Blockchain01Icon";
import Chart01Icon from "@hugeicons/core-free-icons/Chart01Icon";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import { useMobileSheet } from "@/lib/contexts/MobileSheetContext";
import { useSession } from "@/lib/contexts/SessionContext";
import { isAuthExpiredError } from "@/lib/auth/auth-errors";
import { WorkspaceUnavailable } from "@/components/dashboard/WorkspaceUnavailable";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { CreateProjectDialog } from "@/components/dashboard/CreateProjectDialog";
import { useCommandPalette } from "@/lib/contexts/CommandPaletteContext";
import { FeedbackMenu } from "@/components/dashboard/FeedbackMenu";
import { OPEN_CREATE_PROJECT_EVENT, ProjectSwitcherMenuContent } from "@/components/dashboard/ProjectSwitcherMenu";
import { getConsoleRoute } from "@/lib/console/routing";
import { getMainSiteUrl } from "@/lib/main-site-url";
import { useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";
import { announceNavigationIntent, announceSettingsTab } from "@/lib/navigation-intent";

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

// Revenue (formerly Monetization) keeps its own URL but belongs to the AI Gateway sub-nav.
function isAgentPath(pathname: string): boolean {
    return /\/agents\/(?!new(?:\/|$))[^/]+/.test(pathname);
}

/** Phone nav sheet heights, as fractions of the screen: resting, then dragged to the top (the maintenance banner's edge when it shows). */
const NAV_SHEET_SNAPS = [0.7, 1] as const;

function isCopilotPath(pathname: string): boolean {
    return /\/copilot(\/|$)/.test(pathname);
}

function isMemoryPath(pathname: string): boolean {
    return /\/memory(\/|$)/.test(pathname);
}

function isAiGatewayPath(pathname: string): boolean {
    return pathname.includes("/ai-gateway") || /\/(revenue|monetization|end-user-billing)(\/|$)/.test(pathname);
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
    // The nav sheet opens at 70% of the screen and drags up to full height.
    const [sheetSnap, setSheetSnap] = useState<number | string | null>(NAV_SHEET_SNAPS[0]);
    useEffect(() => {
        if (isOpen) setSheetSnap(NAV_SHEET_SNAPS[0]);
    }, [isOpen]);
    const { reportSessionExpired } = useSession();
    const {
        projects: workspaceProjects,
        activeProject,
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
    // One agent's pages are a full-height workspace with their own sub-menu.
    const isAgentWorkspace = isAgentPath(pathname);
    const isMemoryGraph = /\/memory\/graph\/?$/.test(pathname);
    const isCopilotPage = /\/copilot\/?$/.test(pathname);
    const isFixedWorkspace = isPlayground || isAgentWorkspace || isMemoryGraph || isCopilotPage;
    const docsUrl = getMainSiteUrl("/docs");
    const scopedArea = segments[2];
    const isProjectSettingsView = isInsideProject && (
        consoleMode ? pathname === "/settings" || pathname.startsWith("/settings/") : scopedArea === "settings"
    );
    // An integration's own page sits under Settings → Integrations.
    const isIntegrationPage = isProjectSettingsView && pathname.includes("/settings/integrations/");
    // Teams, billing, usage and the audit log live under organization settings, so the
    // settings sub-nav stays open on those pages too.
    const organizationSettingsArea = consoleMode
        ? (pathname === "/organization/settings" ? "settings" : pathname.split("/")[1])
        : scopedArea;
    const isOrganizationSettingsView = !isInsideProject
        && ["settings", "teams", "billing", "usage", "audit-log"].includes(organizationSettingsArea ?? "");
    const [activeView, setActiveView] = useState<"main" | "ai-gateway" | "memory" | "copilot" | "agent" | "project-settings" | "settings">(() => {
        if (isAiGatewayPath(pathname)) return "ai-gateway";
        if (isAgentPath(pathname)) return "agent";
        if (isMemoryPath(pathname)) return "memory";
        if (isCopilotPath(pathname)) return "copilot";
        if (isProjectSettingsView) return "project-settings";
        if (isOrganizationSettingsView) return "settings";
        return "main";
    });
    const [pendingSubnavEntry, setPendingSubnavEntry] = useState<Exclude<typeof activeView, "main"> | null>(null);
    const [createProjectOpen, setCreateProjectOpen] = useState(false);
    // The phone top bar's project switcher asks for this dialog by event.
    useEffect(() => {
        const open = () => setCreateProjectOpen(true);
        window.addEventListener(OPEN_CREATE_PROJECT_EVENT, open);
        return () => window.removeEventListener(OPEN_CREATE_PROJECT_EVENT, open);
    }, []);
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
        // URL first — it's the address and it's synchronous.
        if (routeProjectSlug) return routeProjectSlug;
        // Then the resolved console workspace, when it has landed.
        if (activeProject) return activeProject.slug;
        if (!orgSlug || typeof window === "undefined") return null;
        const visibleProjects = workspaceProjects.filter((project) =>
            project.orgSlug === orgSlug || project.organization_id === organization?.id,
        );
        // Then the last-visited project, validated against projects this
        // account can actually see — a stale hint must never invent scope.
        // This keeps every sidebar and subnav href stable from first paint
        // instead of flipping org-scope → project-scope when context lands.
        try {
            const hint = localStorage.getItem(`cencori:last-project:${orgSlug}`);
            if (hint && visibleProjects.some((project) => project.slug === hint)) return hint;
        } catch {
            // Storage unavailable — fall through to the cached list.
        }
        return (
            visibleProjects.find((project) => project.orgSlug === orgSlug)?.slug ??
            visibleProjects[0]?.slug ??
            null
        );
    }, [activeProject, routeProjectSlug, orgSlug, workspaceProjects, organization?.id]);
    const scopeProjectSlug = isInsideProject ? projectSlug : stickyProjectSlug;
    const scopedProjectHref = (subpath: string) =>
        consoleMode ? `/${subpath}` : `${orgBase}/${scopeProjectSlug}/${subpath}`;
    const orgProductHref = (subpath: string) =>
        consoleMode ? `/organization/${subpath}` : `${orgBase}/~/${subpath}`;
    const aiGatewayHref = scopeProjectSlug ? scopedProjectHref("ai-gateway") : orgProductHref("ai-gateway");
    // Memory belongs to the selected project; without one there is no entry.
    const memoryHref = scopeProjectSlug ? scopedProjectHref("memory") : null;
    // Copilot's pages live under the selected project's address, like Memory.
    const copilotHref = scopeProjectSlug ? scopedProjectHref("copilot") : null;
    // The sidebar Settings entry has one stable meaning: settings for the
    // selected project. Organization settings are entered deliberately from
    // the user menu instead of changing this destination based on the page the
    // user happens to be viewing.
    const settingsHref = consoleMode
        ? "/settings"
        : (scopeProjectSlug ? `${orgBase}/${scopeProjectSlug}/settings` : `${orgBase}/~/projects`);
    const organizationSettingsSection = pendingSubnavEntry === "settings"
        ? "general"
        : organizationSettingsArea === "teams" || organizationSettingsArea === "billing" || organizationSettingsArea === "usage" || organizationSettingsArea === "audit-log"
        ? organizationSettingsArea
        : searchParams.get("section") === "advanced" ? "advanced" : "general";
    const requestedProjectSettingsTab = searchParams.get("tab");
    // Local tab switches (sidebar → settings page event + replaceState) don't
    // touch useSearchParams, so the highlight tracks a local override until
    // the next real navigation.
    const [pendingSettingsTab, setPendingSettingsTab] = useState<string | null>(null);
    const projectSettingsTab = pendingSettingsTab
        ?? (isIntegrationPage
        ? "integrations"
        : pendingSubnavEntry === "project-settings"
        ? "general"
        : ["general", "budget", "providers", "infrastructure", "networking", "integrations", "api", "webhooks"].includes(requestedProjectSettingsTab || "")
        ? requestedProjectSettingsTab
        : "general");

    const isActive = (path: string) => {
        const exactMatchOnly =
            path === basePath ||
            path === orgBase ||
            path === "/home" ||
            path === "/ai-gateway" ||
            path === "/organization/ai-gateway" ||
            path === `${basePath}/ai-gateway` ||
            path === `${orgBase}/~/ai-gateway` ||
            path === memoryHref ||
            path === copilotHref;
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
        setPendingSettingsTab(null);
        if (isAiGatewayPath(pathname)) {
            setActiveView("ai-gateway");
        } else if (isAgentPath(pathname)) {
            setActiveView("agent");
        } else if (isMemoryPath(pathname)) {
            setActiveView("memory");
        } else if (isCopilotPath(pathname)) {
            setActiveView("copilot");
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
        router.prefetch(aiGatewayHref);
        router.prefetch(settingsHref);
    }, [aiGatewayHref, router, settingsHref]);

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
    //   2. (Observability folded into the AI Gateway overview)
    //   3. (Logs moved under AI Gateway — logsItem)
    //   ── separator ──
    //   4. AI Gateway toggle             — expands to projectSubItems
    //   5. AI Gateway toggle, Agents, Memory, Deployments
    //   6. (Teams, Billing, Usage, Audit Log sit under org Settings)
    //   7. bottomItems                   — Settings (fixed final position in every scope)

    const overviewItem = {
        href: consoleMode
            ? "/home"
            : (scopeProjectSlug ? `${orgBase}/${scopeProjectSlug}` : `${orgBase}/~/projects`),
        icon: <HugeiconsIcon icon={DashboardCircleIcon} className="!h-5 !w-5" />,
        label: "Overview",
    };


    // Gateway request logs live under AI Gateway; the top level stays free
    // for platform-wide logs (deployments, runtimes) later.
    const logsItem = {
        href: scopeProjectSlug ? scopedProjectHref("ai-gateway/logs") : orgProductHref("ai-gateway/logs"),
        icon: <HugeiconsIcon icon={LeftToRightListDashIcon} className="!h-5 !w-5" />,
        label: "Logs",
    };


    const projectSubItems = [
        { href: aiGatewayHref, icon: <HugeiconsIcon icon={DashboardCircleIcon} className="!h-5 !w-5" />, label: "Overview" },
        logsItem,
        { href: scopeProjectSlug ? scopedProjectHref("ai-gateway/providers") : orgProductHref("ai-gateway/providers"), icon: <HugeiconsIcon icon={KeySquareIcon} className="!h-5 !w-5" />, label: "BYOK" },
        { href: scopeProjectSlug ? scopedProjectHref("ai-gateway/models") : orgProductHref("ai-gateway/models"), icon: <HugeiconsIcon icon={Blockchain01Icon} className="!h-5 !w-5" />, label: "Models" },
        { href: scopeProjectSlug ? scopedProjectHref("ai-gateway/playground") : orgProductHref("ai-gateway/playground"), icon: <HugeiconsIcon icon={GameController03Icon} className="!h-5 !w-5" />, label: "Playground" },
        { href: scopeProjectSlug ? scopedProjectHref("revenue") : orgProductHref("revenue"), icon: <HugeiconsIcon icon={BadgeDollarSignIcon} className="!h-5 !w-5" />, label: "Revenue" },
    ];

    // Main sidebar groups. AI Gateway (a sub-menu toggle) leads BUILD.
    const buildItems = [
        { href: scopeProjectSlug ? scopedProjectHref("agents") : orgProductHref("agents"), icon: <HugeiconsIcon icon={ThreeDRotateIcon} className="!h-5 !w-5" />, label: "Agents" },
    ];
    const copilotSubItems = copilotHref
        ? [
            { href: copilotHref, icon: <HugeiconsIcon icon={PlusSignIcon} className="!h-5 !w-5" />, label: "New chat" },
            { href: `${copilotHref}/usage`, icon: <HugeiconsIcon icon={Chart01Icon} className="!h-5 !w-5" />, label: "Usage" },
        ]
        : [];
    const memorySubItems = memoryHref
        ? [
            { href: memoryHref, icon: <HugeiconsIcon icon={DashboardCircleIcon} className="!h-5 !w-5" />, label: "Overview" },
            { href: `${memoryHref}/memories`, icon: <HugeiconsIcon icon={LeftToRightListDashIcon} className="!h-5 !w-5" />, label: "Memories" },
            { href: `${memoryHref}/graph`, icon: <HugeiconsIcon icon={ChartRelationshipIcon} className="!h-5 !w-5" />, label: "Graph" },
            { href: `${memoryHref}/controls`, icon: <HugeiconsIcon icon={Settings02Icon} className="!h-5 !w-5" />, label: "Controls" },
        ]
        : [];
    // Deployments stays attached to the selected project for the same stable
    // project → organization → project navigation model.
    const runItems = process.env.NODE_ENV !== "production"
        ? [{ href: scopeProjectSlug ? scopedProjectHref("deployments") : orgProductHref("deployments"), icon: <HugeiconsIcon icon={ThreeDMoveIcon} className="!h-5 !w-5" />, label: "Deployments" }]
        : [];

    const bottomItems = [
        { href: settingsHref, icon: <HugeiconsIcon icon={Settings02Icon} className="!h-5 !w-5" />, label: "Settings" },
    ];

    const organizationSettingsItems = [
        { section: "general", href: consoleMode ? "/organization/settings" : `${orgBase}/~/settings`, label: "General" },
        { section: "advanced", href: consoleMode ? "/organization/settings?section=advanced" : `${orgBase}/~/settings?section=advanced`, label: "Advanced" },
        { section: "teams", href: consoleMode ? "/teams" : `${orgBase}/~/teams`, label: "Teams" },
        { section: "billing", href: consoleMode ? "/billing" : `${orgBase}/~/billing`, label: "Billing" },
        { section: "usage", href: consoleMode ? "/usage" : `${orgBase}/~/usage`, label: "Usage" },
        { section: "audit-log", href: consoleMode ? "/audit-log" : `${orgBase}/~/audit-log`, label: "Audit Log" },
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

    const renderMenuItem = (item: { href: string; icon: React.ReactNode; label: string }) => (
        <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild tooltip={item.label} isActive={isActive(item.href)} size="sm">
                <Link href={item.href} prefetch={true} onMouseEnter={() => prefetchRoute(item.href)}>
                    {item.icon}
                    <span className="text-sm">{item.label}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );

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
                            data-subnav-toggle=""
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

    // The sidebar's navigation, shared by the desktop sidebar and the phone
    // menu sheet so the two always list the same pages.
    const navMenu = (
        activeView === "agent" ? (
            <AgentSubnav />
        ) : activeView === "ai-gateway" || (activeView === "memory" && memoryHref) || (activeView === "copilot" && copilotHref) ? (
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
                {(activeView === "memory" ? memorySubItems : activeView === "copilot" ? copilotSubItems : projectSubItems).map((item) => (
                    <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                            asChild
                            tooltip={item.label}
                            // New chat is an action, not a place: the open conversation
                            // is highlighted under Recent chats instead.
                            isActive={item.href !== copilotHref && (isActive(item.href) || (
                                pendingSubnavEntry === activeView
                                && (item.href === aiGatewayHref || item.href === memoryHref)
                            ))}
                            size="sm"
                        >
                            <Link
                                href={item.href}
                                prefetch={true}
                                onMouseEnter={() => prefetchRoute(item.href)}
                                onClick={item.href === copilotHref ? (event) => {
                                    // Chat opens whatever conversation the cookie names, so
                                    // clear it; if Chat is already open, reset it in place.
                                    document.cookie = `${COPILOT_CONVERSATION_COOKIE}=; path=/; max-age=0; samesite=lax`;
                                    if (pathname === copilotHref) {
                                        event.preventDefault();
                                        window.dispatchEvent(new Event(COPILOT_NEW_CHAT_EVENT));
                                    }
                                } : undefined}
                            >
                                {item.icon}
                                <span className="text-sm">{item.label}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
                {activeView === "copilot" && copilotHref && organization?.id && (
                    <CopilotRecentChats organizationId={organization.id} chatHref={copilotHref} />
                )}
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
                            <Link
                                href={item.href}
                                prefetch={true}
                                onMouseEnter={() => prefetchRoute(item.href)}
                                onClick={(event) => {
                                    // Already on the settings page: swap the
                                    // tab locally instead of navigating.
                                    // The page syncs ?tab= itself so links
                                    // stay shareable. Deep links from
                                    // elsewhere remain normal navigations.
                                    // An integration's own page has no tabs, so navigate.
                                    if (!isProjectSettingsView || isIntegrationPage) {
                                        setPendingSettingsTab(null);
                                        return;
                                    }
                                    event.preventDefault();
                                    setPendingSettingsTab(item.tab);
                                    announceSettingsTab(item.tab);
                                }}
                            >
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
                            data-subnav-toggle=""
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
                {buildItems.map(renderMenuItem)}
                {/* Memory toggle */}
                {memoryHref && (
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={isMemoryPath(pathname)}
                            size="sm"
                            className="gap-1"
                        >
                            <Link
                                href={memoryHref}
                                prefetch={true}
                                data-subnav-toggle=""
                                onClick={() => {
                                    setPendingSubnavEntry("memory");
                                    setActiveView("memory");
                                }}
                                onMouseEnter={() => prefetchRoute(memoryHref)}
                            >
                                <HugeiconsIcon icon={BrainIcon} className="!h-5 !w-5" />
                                <span className="text-sm">Memory</span>
                                <ChevronRight className="!h-3 !w-3 ml-auto text-muted-foreground/50" />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                )}
                {runItems.map(renderMenuItem)}
                {/* Copilot toggle */}
                {copilotHref && (
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={isCopilotPath(pathname)}
                            size="sm"
                            className="gap-1"
                        >
                            <Link
                                href={copilotHref}
                                prefetch={true}
                                data-subnav-toggle=""
                                onClick={() => {
                                    setPendingSubnavEntry("copilot");
                                    setActiveView("copilot");
                                }}
                                onMouseEnter={() => prefetchRoute(copilotHref)}
                            >
                                <HugeiconsIcon icon={AirdropIcon} className="!h-5 !w-5" />
                                <span className="text-sm">Copilot</span>
                                <ChevronRight className="!h-3 !w-3 ml-auto text-muted-foreground/50" />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                )}
                {renderBottomItems()}
            </>
        )
    );

    // Documentation, help and feedback: the desktop sidebar's footer, and the
    // bottom of the phone menu sheet (the phone top bar no longer has them).
    const supportLinks = (
        <>
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
                <DropdownMenuContent align="start" side="top" sideOffset={4} className="w-80 max-h-none overflow-visible !border-0 !bg-[#f3f3f1] dark:!bg-[#101010] p-1 font-mono shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
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
                        <Link href="https://status.cencori.com" target="_blank" rel="noopener noreferrer" className="flex justify-between w-full items-center">
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
        </>
    );

    return (
        <SidebarProvider
            defaultOpen
            // The dashboard shell already fills the viewport (min-h-screen) and adds
            // the header + banner offsets; a second full-height minimum here made
            // every page scroll by that offset even when its content fit.
            className={isFixedWorkspace ? "h-full min-h-0 overflow-hidden" : "min-h-0"}
        >
            {!isProjectCreation && (
                <Sidebar
                    className="top-[var(--maintenance-banner-height,0px)] hidden h-[calc(100svh-var(--maintenance-banner-height,0px))] border-r border-sidebar-border/70 bg-sidebar lg:block"
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
                            <ProjectSwitcherMenuContent
                                projects={availableProjects}
                                selectedProjectId={selectedProject?.id}
                                orgSlug={orgSlug}
                                consoleMode={consoleMode}
                                onCreateProject={() => setCreateProjectOpen(true)}
                            />
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
                                {navMenu}
                            </SidebarMenu>
                        </SidebarGroup>
                    </SidebarContent>
                    <SidebarFooter className="pt-1 space-y-0.5">
                        {supportLinks}
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

            <Drawer.Root
                open={isOpen}
                onOpenChange={setIsOpen}
                snapPoints={[...NAV_SHEET_SNAPS]}
                activeSnapPoint={sheetSnap}
                setActiveSnapPoint={setSheetSnap}
                fadeFromIndex={0}
            >
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-x-0 top-[var(--maintenance-banner-height,0px)] bottom-0 z-50 bg-black/50 lg:hidden" />
                    <Drawer.Content
                        className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(100svh-var(--maintenance-banner-height,0px))] flex-col rounded-t-2xl bg-background outline-none lg:hidden"
                        onClickCapture={(event) => {
                            handleSidebarNavigationCapture(event);
                            // A page link closes the sheet; a link that opens a sub-menu
                            // (AI Gateway, Memory, Copilot, Settings) keeps it up to show it.
                            const link = (event.target as HTMLElement).closest("a");
                            if (link && !link.hasAttribute("data-subnav-toggle")) setIsOpen(false);
                        }}
                    >
                        {/* Screen readers announce the sheet by these; Radix requires a title. */}
                        <Drawer.Title className="sr-only">Navigation</Drawer.Title>
                        <Drawer.Description className="sr-only">Pages in this project and organization.</Drawer.Description>
                        <div aria-hidden="true" className="mx-auto mt-3 mb-1 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/40" />
                        {/* Scrolls only at full height, so a drag on the list moves the sheet until then.
                            pb clears the tab bar, which floats over the sheet. */}
                        <div
                            className={cn(
                                "min-h-0 flex-1 pt-2 pb-24",
                                sheetSnap === NAV_SHEET_SNAPS[1] ? "overflow-y-auto" : "overflow-hidden",
                            )}
                        >
                            <SidebarGroup>
                                <SidebarMenu>{navMenu}</SidebarMenu>
                            </SidebarGroup>
                            <div className="mt-10 space-y-0.5 px-2">{supportLinks}</div>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>

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

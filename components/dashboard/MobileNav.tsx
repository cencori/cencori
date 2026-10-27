"use client";

import { usePathname } from "next/navigation";
import { useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";
import {
    DropdownMenu,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDown } from "lucide-react";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { ProjectSwitcherMenuContent } from "@/components/dashboard/ProjectSwitcherMenu";
import { getCanonicalConsoleRedirect, getConsoleRoute } from "@/lib/console/routing";

// Pages whose title sits in the centre of this bar on phones (they drop
// their own heading there), by their flat console path.
const BAR_TITLES: Record<string, string> = {
    "/ai-gateway/logs": "Logs",
    "/ai-gateway/playground": "Playground",
    "/ai-gateway/models": "Models",
    "/organization/ai-gateway/models": "Models",
};

interface MobileNavProps {
    onMenuClick: () => void;
    projectSlug?: string | null;
    user?: { email?: string | null };
    avatar?: string | null;
    /**
     * "sticky": pinned to the top as the page scrolls. Full-screen workspaces
     * don't scroll, so there it sits in the flow ("inline"), or above the
     * fixed top bar when that shows on phones too ("aboveHeader"), leaving
     * room for it underneath.
     */
    placement?: "sticky" | "inline" | "aboveHeader";
}

export function MobileNav({ projectSlug, placement = "sticky" }: MobileNavProps) {
    const pathname = usePathname();
    const {
        organizations,
        projects,
        activeOrganization,
        activeProject,
    } = useOrganizationProject();

    const getOrgSlug = () => {
        if (pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
            return null;
        }
        if (pathname.startsWith("/account/") || pathname === "/account") {
            return null;
        }
        const match = pathname.match(/^\/([^/]+)/);
        return match ? match[1] : null;
    };

    const consoleRoute = getConsoleRoute(pathname);
    const orgSlug = consoleRoute ? activeOrganization?.slug ?? null : getOrgSlug();
    const resolvedProjectSlug = consoleRoute?.scope === "project"
        ? activeProject?.slug ?? projectSlug
        : projectSlug;
    const currentOrg = organizations.find((org) => org.slug === orgSlug);
    const currentProject = projects.find((proj) => proj.slug === resolvedProjectSlug && proj.orgSlug === orgSlug);

    // Get available orgs and projects for dropdowns
    const availableProjects = projects.filter((proj) => proj.orgSlug === orgSlug);
    // The same page under /{org}/{project}/… reads as its flat path.
    const title = BAR_TITLES[consoleRoute?.canonicalPath ?? getCanonicalConsoleRedirect(pathname)?.canonicalPath ?? ""];

    return (
        // In a full-screen workspace it takes its place in the flow, pushing the
        // workspace down instead of floating over it (sticky there would add
        // the banner's height twice).
        <div className={`${placement === "sticky" ? "sticky top-[var(--maintenance-banner-height,0px)]" : `relative shrink-0 ${placement === "aboveHeader" ? "mb-12" : ""}`} z-50 lg:hidden border-b border-border/40 bg-background`}>
            <div className="relative flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-hide">
                {/* Project selector dropdown */}
                {resolvedProjectSlug && (
                    <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="flex h-7 shrink-0 items-center rounded-full border border-border bg-secondary/50 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                                    aria-label="Switch project"
                                >
                                    {/* Shorter beside a centred title, so the two never meet. */}
                                    <span className={`${title ? "max-w-20" : "max-w-40"} truncate pl-3 pr-2`}>{currentProject?.name || resolvedProjectSlug}</span>
                                    <span aria-hidden="true" className="h-3.5 w-px bg-border" />
                                    <ChevronsUpDown className="mx-2 h-3 w-3 text-muted-foreground" />
                                </button>
                            </DropdownMenuTrigger>
                            <ProjectSwitcherMenuContent
                                projects={availableProjects}
                                selectedProjectId={currentProject?.id}
                                orgSlug={orgSlug}
                                consoleMode={Boolean(consoleRoute)}
                            />
                    </DropdownMenu>
                )}

                {title && (
                    <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-sm font-medium">{title}</h1>
                )}

                {/* Spacer */}
                <div className="flex-1 min-w-4" />

                {/* The desktop sidebar's profile menu, opened from the avatar. */}
                <UserMenu
                    variant="avatar"
                    organization={currentOrg ? {
                        id: currentOrg.id,
                        name: currentOrg.name,
                        slug: currentOrg.slug,
                        subscriptionTier: currentOrg.subscription_tier ?? "free",
                    } : undefined}
                />
            </div>
        </div>
    );
}

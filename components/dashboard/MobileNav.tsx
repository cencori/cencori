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
import { getConsoleRoute } from "@/lib/console/routing";

interface MobileNavProps {
    onMenuClick: () => void;
    projectSlug?: string | null;
    user?: { email?: string | null };
    avatar?: string | null;
    /** True when the fixed top bar shows on phones too, so this bar sits under it. */
    belowHeader?: boolean;
}

export function MobileNav({ projectSlug, belowHeader = false }: MobileNavProps) {
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

    return (
        <div className={`sticky ${belowHeader ? "top-[calc(3rem+var(--maintenance-banner-height,0px))]" : "top-[var(--maintenance-banner-height,0px)]"} z-50 lg:hidden border-b border-border/40 bg-background`}>
            <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-hide">
                {/* Project selector dropdown */}
                {resolvedProjectSlug && (
                    <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="flex h-7 shrink-0 items-center rounded-full border border-border bg-secondary/50 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                                    aria-label="Switch project"
                                >
                                    <span className="max-w-40 truncate pl-3 pr-2">{currentProject?.name || resolvedProjectSlug}</span>
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

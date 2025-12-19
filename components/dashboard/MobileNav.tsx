"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";
import { useEnvironment } from "@/lib/contexts/EnvironmentContext";
import { ChevronsUpDown, HelpCircle } from "lucide-react";

interface MobileNavProps {
    onMenuClick: () => void;
    projectSlug?: string | null;
}

export function MobileNav({ projectSlug }: MobileNavProps) {
    const pathname = usePathname();
    const { organizations, projects } = useOrganizationProject();
    const { setEnvironment, isTestMode } = useEnvironment();

    const getOrgSlug = () => {
        const match = pathname.match(/organizations\/([^/]+)/);
        return match ? match[1] : null;
    };

    const orgSlug = getOrgSlug();
    const currentOrg = organizations.find((org) => org.slug === orgSlug);
    const currentProject = projects.find((proj) => proj.slug === projectSlug && proj.orgSlug === orgSlug);

    return (
        <div className="sticky top-12 z-40 lg:hidden border-b border-border/40 bg-background">
            {/* Scrollable breadcrumb row */}
            <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-hide">
                {/* Organization selector */}
                {orgSlug && (
                    <>
                        <Link
                            href={`/dashboard/organizations/${orgSlug}/projects`}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-foreground bg-secondary/50 hover:bg-secondary rounded-md transition-colors shrink-0"
                        >
                            {currentOrg?.name || "Organization"}
                            <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
                        </Link>
                        {currentOrg?.subscription_tier && (
                            <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                                {currentOrg.subscription_tier}
                            </span>
                        )}
                    </>
                )}

                {/* Project selector */}
                {projectSlug && (
                    <>
                        <span className="text-muted-foreground/50 text-xs shrink-0">/</span>
                        <Link
                            href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}`}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-foreground bg-secondary/50 hover:bg-secondary rounded-md transition-colors shrink-0"
                        >
                            {currentProject?.name || projectSlug}
                            <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
                        </Link>
                    </>
                )}

                {/* Environment Toggle */}
                {projectSlug && (
                    <div className="flex items-center bg-muted/30 rounded-full p-0.5 border border-border/40 ml-2 shrink-0">
                        <button
                            onClick={() => setEnvironment("production")}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${!isTestMode
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : "text-muted-foreground"
                                }`}
                        >
                            Prod
                        </button>
                        <button
                            onClick={() => setEnvironment("test")}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${isTestMode
                                ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                                : "text-muted-foreground"
                                }`}
                        >
                            Dev
                        </button>
                    </div>
                )}

                {/* Spacer */}
                <div className="flex-1 min-w-4" />

                {/* Action buttons */}
                <button
                    type="button"
                    className="px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                    Feedback
                </button>

                <button
                    type="button"
                    className="w-6 h-6 flex items-center justify-center rounded-full border border-border/40 hover:bg-secondary transition-colors shrink-0"
                    aria-label="Help"
                >
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
            </div>
        </div>
    );
}

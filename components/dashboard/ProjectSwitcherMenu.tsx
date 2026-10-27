"use client";

import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import Settings02Icon from "@hugeicons/core-free-icons/Settings02Icon";
import { Check, Plus } from "lucide-react";
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useOrganizationProject, type Project } from "@/lib/contexts/OrganizationProjectContext";
import { announceNavigationIntent } from "@/lib/navigation-intent";
import { swapWorkspaceInPath } from "@/lib/workspace-switch";

/** Fired to open the Create project dialog, which the organization layout owns. */
export const OPEN_CREATE_PROJECT_EVENT = "cencori:open-create-project";

interface ProjectSwitcherMenuContentProps {
    projects: Project[];
    selectedProjectId?: string | null;
    orgSlug: string | null;
    consoleMode: boolean;
    /** Defaults to asking the organization layout to open its dialog. */
    onCreateProject?: () => void;
    align?: "start" | "end";
}

/**
 * The project switcher's menu: the projects in this organization, then Create
 * project and Manage projects. Shared by the desktop sidebar header and the
 * phone top bar so both offer the same choices.
 */
export function ProjectSwitcherMenuContent({
    projects,
    selectedProjectId,
    orgSlug,
    consoleMode,
    onCreateProject,
    align = "start",
}: ProjectSwitcherMenuContentProps) {
    const router = useRouter();
    const { selectProject } = useOrganizationProject();

    const switchTo = async (project: Project) => {
        if (consoleMode) {
            let switched = false;
            try {
                switched = await selectProject(project.id);
            } catch {
                switched = false;
            }
            if (switched) {
                // Cookies carry the new workspace; the flat URL stays valid,
                // so refresh keeps the current page under the new project.
                router.refresh();
                return;
            }
        }
        // Slug hosts (and the console fallback): keep the subpath, swap the
        // workspace segments.
        const preserved = (orgSlug && swapWorkspaceInPath(
            window.location.pathname,
            orgSlug,
            project.slug,
        )) || `/${orgSlug ?? project.orgSlug}/${project.slug}`;
        announceNavigationIntent(preserved);
        router.push(preserved);
    };

    return (
        <DropdownMenuContent
            side="bottom"
            align={align}
            sideOffset={5}
            className="z-[70] w-64 rounded-xl !border-0 !bg-[#f3f3f1] p-1 shadow-[0_18px_48px_rgba(0,0,0,0.35)] data-[state=closed]:!animate-none data-[state=open]:!animate-none dark:!bg-[#181818]"
        >
            <p className="px-3 pb-1 pt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Projects
            </p>
            <div className="max-h-52 overflow-y-auto">
                {projects.map((project) => (
                    <DropdownMenuItem
                        key={project.id}
                        className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px] font-medium"
                        onClick={() => void switchTo(project)}
                    >
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        {project.id === selectedProjectId && (
                            <Check className="ml-auto size-4 shrink-0" />
                        )}
                    </DropdownMenuItem>
                ))}
                {projects.length === 0 && (
                    <p className="px-3 py-3 text-xs text-muted-foreground">No projects yet.</p>
                )}
            </div>
            <DropdownMenuSeparator className="-mx-1 my-1 bg-border/35" />
            <DropdownMenuItem
                className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px]"
                onSelect={() => {
                    if (onCreateProject) onCreateProject();
                    else window.dispatchEvent(new Event(OPEN_CREATE_PROJECT_EVENT));
                }}
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
    );
}

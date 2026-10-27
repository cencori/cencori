"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Link2, Settings } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AgentWorkspaceProvider, useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { AgentTestPanel } from "@/components/agents/AgentTestPanel";
import { WidgetPreviewProvider, useCopyShareLink } from "@/components/agents/widget-preview";
import { useAgentsBasePath } from "@/components/agents/studio";
import { useProjectIdBySlug } from "@/lib/hooks/useQueries";
import { AGENT_HEADER_ACTIONS_SLOT_ID } from "@/lib/console/copilot";
import { cn } from "@/lib/utils";

const TEST_PANEL_KEY = "cencori:agent-test-panel";
/** One half of the Publish split button: the shared shell draws the shape. A disabled half dims its label, not the fill. */
const SPLIT_PART = "h-6 gap-1.5 rounded-none px-2.5 text-xs shadow-none disabled:opacity-100 disabled:text-primary-foreground/45";

/**
 * The top-bar slot the dashboard layout renders for agent pages. Looked up on
 * every render (never cached), and any DOM change re-renders, so the buttons
 * always land in the live slot, even after the layout swaps it out (a hot
 * reload or a remount).
 */
function useHeaderSlot(): HTMLElement | null {
    const [, setTick] = useState(0);
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        let current = document.getElementById(AGENT_HEADER_ACTIONS_SLOT_ID);
        const observer = new MutationObserver(() => {
            const next = document.getElementById(AGENT_HEADER_ACTIONS_SLOT_ID);
            if (next !== current) {
                current = next;
                setTick((tick) => tick + 1);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, []);
    return mounted ? document.getElementById(AGENT_HEADER_ACTIONS_SLOT_ID) : null;
}

function HeaderContent({ testOpen, onToggleTest }: { testOpen: boolean; onToggleTest: () => void }) {
    const { agent, canManage, editable, visualEditable, busy, newVersion, publish } = useAgentWorkspace();
    const basePath = useAgentsBasePath();
    const share = useCopyShareLink();
    const slot = useHeaderSlot();
    if (!slot) return null;

    const canPublish = canManage && visualEditable;

    return (
        <>
            {createPortal(
                <>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onToggleTest}
                        aria-pressed={testOpen}
                        className={cn("h-6 gap-1.5 px-2.5 text-xs", testOpen && "bg-muted")}
                    >
                        Preview
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-6 w-6 px-0">
                        <Link href={`${basePath}/${encodeURIComponent(agent.id)}/settings`} aria-label="Agent settings" title="Settings">
                            <Settings className="h-3.5 w-3.5" />
                        </Link>
                    </Button>
                    {canManage && (
                        <div className="flex h-6 items-stretch overflow-hidden rounded-md bg-primary shadow-sm">
                            {editable ? (
                                <Button
                                    size="sm"
                                    className={SPLIT_PART}
                                    onClick={() => void publish()}
                                    disabled={!canPublish || !!busy}
                                >
                                    {busy === "publish_version" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                                    Publish
                                </Button>
                            ) : (
                                <Button size="sm" className={SPLIT_PART} onClick={() => void newVersion()} disabled={!!busy}>
                                    New draft
                                </Button>
                            )}
                            <span aria-hidden className="w-px bg-primary-foreground/20" />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="sm" className={cn(SPLIT_PART, "w-6 px-0")} aria-label="More publishing options">
                                        {share.copying ? <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-44">
                                    <DropdownMenuItem
                                        className="gap-2 text-xs"
                                        disabled={!share.published || share.copying}
                                        onSelect={() => void share.copy()}
                                    >
                                        <Link2 className="h-3.5 w-3.5" />
                                        {share.published ? "Copy link" : "Copy link (publish first)"}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </>,
                slot,
            )}
        </>
    );
}

function ShellBody({ children }: { children: ReactNode }) {
    const { data, error, setError, test } = useAgentWorkspace();
    const [testOpen, setTestOpen] = useState(true);

    // "Start a conversation" anywhere opens the panel (the panel focuses itself).
    useEffect(() => {
        if (test.focusRequest > 0) setTestOpen(true);
    }, [test.focusRequest]);

    useEffect(() => {
        try { setTestOpen(localStorage.getItem(TEST_PANEL_KEY) !== "0"); } catch { /* storage unavailable */ }
    }, []);

    const setOpen = useCallback((open: boolean) => {
        setTestOpen(open);
        try { localStorage.setItem(TEST_PANEL_KEY, open ? "1" : "0"); } catch { /* storage unavailable */ }
    }, []);
    const openPanel = useCallback(() => setOpen(true), [setOpen]);
    // Settings uses the console settings pages' width (project and organization settings).
    const wide = usePathname()?.endsWith("/settings") ?? false;

    return (
        <WidgetPreviewProvider openPanel={openPanel}>
        <div className="flex min-h-0 flex-1 overflow-hidden">
            <HeaderContent testOpen={testOpen} onToggleTest={() => setOpen(!testOpen)} />
            {/* Phones: the preview takes the page's place (below), so it starts
                right under the profile bar instead of floating over the page. */}
            <div className={cn("no-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain", testOpen && "max-lg:hidden")}>
                {!data.studio_ready && (
                    <div role="status" className="border-b border-border/40 bg-muted/50 px-6 py-3 text-xs leading-5 text-muted-foreground">
                        This database is missing the version-test migration. You can browse agents, but creating, testing, and publishing are paused until it is applied.
                    </div>
                )}
                {/* Agent pages are a full-screen workspace with no layout gutter, so they
                    carry the phone gutter (20px, matching other pages) themselves. */}
                <div className={cn("mx-auto w-full", wide ? "max-w-[1180px] px-5 pt-6 pb-12 sm:px-6 sm:pt-12 lg:px-10" : "max-w-[1000px] px-5 pb-10 pt-6 sm:px-6 sm:pt-4 lg:px-8 lg:pt-6")}>
                    {error && (
                        <div role="alert" className="mb-6 flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-xs text-destructive">
                            <span>{error}</span>
                            <button type="button" onClick={() => setError(null)} className="shrink-0 underline-offset-2 hover:underline">Dismiss</button>
                        </div>
                    )}
                    {children}
                </div>
            </div>
            {testOpen && (
                <div className="flex min-w-0 flex-1 bg-background lg:w-[380px] lg:flex-none lg:shrink-0 xl:w-[420px]">
                    <AgentTestPanel onClose={() => setOpen(false)} />
                </div>
            )}
        </div>
        </WidgetPreviewProvider>
    );
}

/** The frame for one agent's pages: workspace, top-bar header and test panel. */
export function AgentShell({ orgSlug, projectSlug, agentId, children }: { orgSlug: string; projectSlug: string; agentId: string; children: ReactNode }) {
    const { data: projectId, isLoading } = useProjectIdBySlug(orgSlug, projectSlug);
    const basePath = useAgentsBasePath();

    if (isLoading) return <ShellSkeleton />;
    if (!projectId) return <p className="p-8 text-sm text-muted-foreground">Project not found.</p>;

    return (
        <AgentWorkspaceProvider
            projectId={projectId}
            agentId={agentId}
            fallback={(state) => {
                if (state.status === "loading") return <ShellSkeleton />;
                if (state.status === "missing") {
                    return (
                        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                            <p className="text-sm font-medium">Agent not found</p>
                            <p className="mt-1 text-xs text-muted-foreground">It may have been deleted, or it belongs to another project.</p>
                            <Button asChild size="sm" className="mt-4 h-7 text-xs"><Link href={basePath}>All agents</Link></Button>
                        </div>
                    );
                }
                return (
                    <div role="alert" className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                        <p className="text-sm font-medium">Agent workspace unavailable</p>
                        <p className="mt-1 text-xs text-muted-foreground">{state.message}</p>
                        <Button size="sm" className="mt-4 h-7 text-xs" onClick={state.retry}>Try again</Button>
                    </div>
                );
            }}
        >
            <ShellBody>{children}</ShellBody>
        </AgentWorkspaceProvider>
    );
}

/** Blank while the agent loads: each page draws its own skeleton, so the shell doesn't add a second one. */
function ShellSkeleton() {
    return (
        <div className="flex min-h-0 flex-1">
            <div className="flex-1" />
            <div className="hidden w-[380px] border-l border-border/40 lg:block xl:w-[420px]" />
        </div>
    );
}

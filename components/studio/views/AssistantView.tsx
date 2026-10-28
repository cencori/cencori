"use client";

import { useStudio } from "@/components/studio/StudioShell";
import { StudioLoadError } from "@/components/studio/studio-data";
import { StudioLink } from "@/components/studio/studio-nav";
import { useAssistants } from "@/components/studio/useAssistants";
import { useStudioOverview } from "@/components/studio/useStudioOverview";
import { useStudioTasks } from "@/components/studio/StudioTasks";
import { AgentOrb } from "@/components/agents/AgentOrb";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChevronRight, Plus } from "lucide-react";

export function assistantStatus(assistant: { published: boolean; active: boolean }): { label: string; tone: string; dot: string } {
    if (!assistant.published) return { label: "Not live yet", tone: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-amber-500" };
    if (!assistant.active) return { label: "Paused", tone: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" };
    return { label: "Live", tone: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500" };
}

/** The AI tab: every assistant in the business, one or many, and a way to add another. */
export default function StudioAssistantsPage() {
    const { organization } = useStudio();
    const list = useAssistants();
    const plan = useStudioOverview().data?.plan ?? null;
    const tasks = useStudioTasks();
    const assistants = list.data?.assistants ?? [];
    const full = !!plan && assistants.length >= plan.agents;

    return (
        <div>
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight">Assistants</h1>
            {list.isLoading ? (
                <div className="mt-5 space-y-2.5">{[0, 1].map((index) => <Skeleton key={index} className="h-[76px] w-full rounded-2xl" />)}</div>
            ) : !list.data ? (
                <StudioLoadError error={list.error} fallback="Couldn't load your assistants." onRetry={() => void list.refetch()} />
            ) : (
                // A pill each: every assistant (live ones first), then adding one.
                <ul className="mt-5 flex flex-col gap-2.5">
                    {[...assistants].sort((a, b) => Number(b.published && b.active) - Number(a.published && a.active)).map((assistant) => {
                        const status = assistantStatus(assistant);
                        return (
                            <li key={assistant.id}>
                                <StudioLink href={`/assistant/${assistant.id}`} className="flex items-center gap-3 rounded-full bg-muted/60 py-2.5 pl-2.5 pr-5 active:bg-muted">
                                    <AgentOrb seed={assistant.id} className="h-11 w-11" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[15px] font-semibold">{assistant.name}</span>
                                        {/* Live is the normal state, so it goes unsaid; Paused or Not live yet is worth seeing. */}
                                        {status.label !== "Live" && (
                                            <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                                                <span className={cn("h-2 w-2 rounded-full", status.dot)} />{status.label}
                                            </span>
                                        )}
                                    </span>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                </StudioLink>
                            </li>
                        );
                    })}
                    <li>
                        {full ? (
                            <button type="button" onClick={() => tasks.open("plans")} className="flex w-full items-center gap-3 rounded-full bg-muted/60 py-2.5 pl-2.5 pr-5 text-left active:bg-muted">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground/10"><Plus className="h-5 w-5" /></span>
                                <span className="min-w-0 flex-1 text-[15px] font-semibold">Add assistant</span>
                                <span className="shrink-0 rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-violet-600 dark:text-violet-300">Upgrade</span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </button>
                        ) : (
                            // Setup, from the start, for a new assistant in this business.
                            <StudioLink href="/setup?new=1" className="flex items-center gap-3 rounded-full bg-muted/60 py-2.5 pl-2.5 pr-5 active:bg-muted">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-500 dark:text-emerald-400"><Plus className="h-5 w-5" /></span>
                                <span className="min-w-0 flex-1 text-[15px] font-semibold">{assistants.length ? "Add assistant" : `Set up ${organization.name}'s assistant`}</span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </StudioLink>
                        )}
                    </li>
                </ul>
            )}
        </div>
    );
}

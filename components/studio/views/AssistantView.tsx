"use client";

import { useStudio } from "@/components/studio/StudioShell";
import { StudioLoadError } from "@/components/studio/studio-data";
import { StudioLink } from "@/components/studio/studio-nav";
import { useAssistants, type StudioAssistantRow } from "@/components/studio/useAssistants";
import { useStudioOverview } from "@/components/studio/useStudioOverview";
import { useStudioTasks } from "@/components/studio/StudioTasks";
import { AgentOrb } from "@/components/agents/AgentOrb";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function assistantStatus(assistant: { published: boolean; active: boolean }): { label: string; tone: string } {
    if (!assistant.published) return { label: "Not live yet", tone: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" };
    if (!assistant.active) return { label: "Paused", tone: "bg-muted text-muted-foreground" };
    return { label: "Live", tone: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" };
}

function where(assistant: StudioAssistantRow): string {
    const places = [assistant.whatsapp && "WhatsApp", assistant.link && "Link", assistant.website && "Website"].filter(Boolean);
    return places.length ? places.join(" · ") : "Not on any channel yet";
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
                <>
                    <ul className="mt-5 flex flex-col gap-2.5">
                        {assistants.map((assistant) => {
                            const status = assistantStatus(assistant);
                            return (
                                <li key={assistant.id}>
                                    <StudioLink href={`/assistant/${assistant.id}`} className="flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3.5 active:bg-muted/60">
                                        <AgentOrb seed={assistant.id} className="h-11 w-11" />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2">
                                                <span className="min-w-0 truncate text-[15px] font-semibold">{assistant.name}</span>
                                                <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", status.tone)}>{status.label}</span>
                                            </span>
                                            <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{where(assistant)}</span>
                                        </span>
                                        <span className="shrink-0 text-right">
                                            <span className="block text-[15px] font-semibold">{assistant.chats_this_week}</span>
                                            <span className="block text-[11px] text-muted-foreground">this week</span>
                                        </span>
                                    </StudioLink>
                                </li>
                            );
                        })}
                    </ul>
                    {full ? (
                        <button type="button" onClick={() => tasks.open("plans")} className="mt-4 h-12 w-full rounded-full border border-border/60 text-[15px] font-medium">
                            {plan!.agents === 1 ? "Upgrade to add another assistant" : `Upgrade for more than ${plan!.agents} assistants`}
                        </button>
                    ) : (
                        // Setup, from the start, for a new assistant in this business.
                        <StudioLink href="/setup?new=1" className="mt-4 flex h-12 w-full items-center justify-center rounded-full border border-border/60 text-[15px] font-medium">
                            {assistants.length ? "Add assistant" : `Set up ${organization.name}'s assistant`}
                        </StudioLink>
                    )}
                </>
            )}
        </div>
    );
}

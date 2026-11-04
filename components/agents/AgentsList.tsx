"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { agentStatus, statusTone, useAgentStudio, useAgentsBasePath } from "@/components/agents/studio";
import { AgentsGetStarted } from "@/components/agents/AgentsGetStarted";
import { AgentOrb } from "@/components/agents/AgentOrb";
import { cn } from "@/lib/utils";

/** The project's agents, or a way to make the first one. */
export function AgentsList({ projectId }: { projectId: string }) {
    const basePath = useAgentsBasePath();
    const { data, isLoading, error, refetch } = useAgentStudio(projectId);
    const [search, setSearch] = useState("");

    const rows = useMemo(() => {
        if (!data) return [];
        const term = search.trim().toLowerCase();
        return data.agents
            .filter((agent) => !term || agent.name.toLowerCase().includes(term))
            .map((agent) => {
                const published = data.versions.find((version) => version.id === agent.stable_version_id);
                const draft = data.versions.filter((version) => version.agent_id === agent.id)[0];
                return {
                    agent,
                    version: published?.version ?? draft?.version ?? null,
                    customers: data.installations.filter((item) => item.agent_id === agent.id).length,
                };
            });
    }, [data, search]);

    const canManage = !!data?.can_manage && !!data?.studio_ready;

    return (
        <div>
            <header className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-base font-medium">Agents</h1>
                </div>
                {canManage && data && data.agents.length > 0 && (
                    <Button asChild size="sm" className="h-7 text-xs"><Link href={`${basePath}/new`}>Create agent</Link></Button>
                )}
            </header>

            {isLoading ? (
                <ListSkeleton />
            ) : error || !data ? (
                <div className="flex flex-col items-center py-16 text-center">
                    <p className="text-sm font-medium">Agents unavailable</p>
                    <p className="mt-1 text-xs text-muted-foreground">{error instanceof Error ? error.message : "We couldn't load this project's agents."}</p>
                    <Button size="sm" className="mt-4 h-7 text-xs" onClick={() => void refetch()}>Try again</Button>
                </div>
            ) : data.agents.length === 0 ? (
                <AgentsGetStarted canManage={canManage} studioReady={!!data.studio_ready} />
            ) : (
                <>
                    <div className="mb-4 flex justify-end">
                        <div className="relative w-full sm:w-[260px]">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agents…" className="h-7 pl-8 text-xs shadow-none" />
                        </div>
                    </div>
                    {rows.length === 0 ? (
                        <p className="rounded-xl bg-muted/30 px-5 py-12 text-center text-xs text-muted-foreground">No agents match that search.</p>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {rows.map(({ agent, version, customers }) => {
                                const href = `${basePath}/${encodeURIComponent(agent.id)}`;
                                return (
                                    <Link
                                        key={agent.id}
                                        href={href}
                                        className="group flex flex-col rounded-xl border border-border/40 bg-muted/30 p-4 transition-colors hover:border-border/70 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <AgentOrb seed={agent.id} className="h-8 w-8" />
                                        <div className="mt-3 flex min-w-0 items-center gap-2">
                                            <h2 className="truncate text-sm font-medium">{agent.name}</h2>
                                            <StatusPill status={agentStatus(agent)} />
                                        </div>
                                        <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs leading-4 text-muted-foreground">
                                            {agent.description || "No description yet."}
                                        </p>
                                        <div className="mt-4 flex items-center justify-between gap-3">
                                            <span className="inline-flex h-7 items-center rounded-md bg-muted px-3 text-xs font-medium transition-colors group-hover:bg-muted-foreground/20">
                                                Configure
                                            </span>
                                            <span className="font-mono text-[11px] text-muted-foreground">
                                                {version ? `v${version}` : "No version"} · {customers} {customers === 1 ? "customer" : "customers"}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

const PILL_BG: Record<string, string> = {
    published: "bg-emerald-500/10",
    draft: "bg-amber-500/10",
};

/** The agent's status as a soft tinted pill beside its name. */
function StatusPill({ status }: { status: string }) {
    const tone = statusTone(status);
    return (
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize", tone.text, PILL_BG[status.toLowerCase()] ?? "bg-muted")}>
            {status}
        </span>
    );
}

function ListSkeleton() {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-[156px] w-full rounded-xl" />
            ))}
        </div>
    );
}

/**
 * The list while the project itself is still resolving: the same header and
 * skeleton the list shows while its agents load, so the page has one loading
 * state instead of two in a row.
 */
export function AgentsListSkeleton() {
    return (
        <div>
            <header className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-base font-medium">Agents</h1>
                </div>
            </header>
            <ListSkeleton />
        </div>
    );
}

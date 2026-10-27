"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Status, agentStatus, useAgentStudio, useAgentsBasePath } from "@/components/agents/studio";
import { AgentsGetStarted } from "@/components/agents/AgentsGetStarted";
import { AgentOrb } from "@/components/agents/AgentOrb";
import { cn } from "@/lib/utils";

const HEAD_CLASS = "h-8 text-[10px] font-medium uppercase tracking-wider text-muted-foreground";

/** The project's agents, or a way to make the first one. */
export function AgentsList({ projectId }: { projectId: string }) {
    const router = useRouter();
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
                    <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                        {rows.length === 0 ? (
                            <p className="px-5 py-12 text-center text-xs text-muted-foreground">No agents match that search.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                {/* Phones: full width for names, the table scrolls sideways instead of squeezing them. */}
                                <Table className="min-w-[640px] lg:min-w-0">
                                    <TableHeader>
                                        <TableRow className="border-b border-border/40 hover:bg-transparent">
                                            <TableHead className={cn(HEAD_CLASS, "px-3")}>Agent</TableHead>
                                            <TableHead className={cn(HEAD_CLASS, "w-[120px]")}>Status</TableHead>
                                            <TableHead className={cn(HEAD_CLASS, "w-[90px]")}>Version</TableHead>
                                            <TableHead className={cn(HEAD_CLASS, "w-[100px] text-right")}>Customers</TableHead>
                                            <TableHead className={cn(HEAD_CLASS, "w-[110px] pr-3 text-right")}>Created</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map(({ agent, version, customers }) => (
                                            <TableRow
                                                key={agent.id}
                                                className="cursor-pointer border-b border-border/40 last:border-b-0 hover:bg-muted/50"
                                                onClick={() => router.push(`${basePath}/${encodeURIComponent(agent.id)}`)}
                                                // Load the agent's page while the pointer is on its row, so the click opens it instantly.
                                                onMouseEnter={() => router.prefetch(`${basePath}/${encodeURIComponent(agent.id)}`)}
                                                onTouchStart={() => router.prefetch(`${basePath}/${encodeURIComponent(agent.id)}`)}
                                            >
                                                <TableCell className="w-full max-w-0 px-3 py-2.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <AgentOrb seed={agent.id} className="h-6 w-6" />
                                                        <div className="min-w-0">
                                                            <p className="truncate text-xs font-medium">{agent.name}</p>
                                                            {agent.description && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{agent.description}</p>}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-2.5"><Status status={agentStatus(agent)} /></TableCell>
                                                <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">{version ? `v${version}` : "—"}</TableCell>
                                                <TableCell className="py-2.5 text-right font-mono text-xs text-muted-foreground">{customers}</TableCell>
                                                <TableCell className="whitespace-nowrap py-2.5 pr-3 text-right text-xs text-muted-foreground">{new Date(agent.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function ListSkeleton() {
    return <Skeleton className="h-[320px] w-full rounded-lg" />;
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

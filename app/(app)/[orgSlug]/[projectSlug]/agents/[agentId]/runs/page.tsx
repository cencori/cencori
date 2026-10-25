"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { useAgentRuns } from "@/components/agents/useAgentStats";
import { RunsTable } from "@/components/agents/RunsTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 50;
const STATUSES = ["completed", "failed", "running", "queued", "requires_action", "cancelled", "expired"];

/** Every run of this agent, newest first, a page at a time. */
export default function AgentRunsPage() {
    const { agent, data, projectId } = useAgentWorkspace();
    const [status, setStatus] = useState("all");
    const [offset, setOffset] = useState(0);
    const { data: page, isLoading, error } = useAgentRuns(projectId, agent.id, { limit: PAGE_SIZE, offset, status });
    const runs = page?.runs ?? [];

    return (
        <div>
            <header className="mb-6">
                <h1 className="text-base font-medium">Runs</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">Every time a customer used this agent.</p>
            </header>
            <div className="mb-4 flex">
                <Select value={status} onValueChange={(value) => { setStatus(value); setOffset(0); }}>
                    <SelectTrigger className="h-7 w-[170px] text-xs shadow-none dark:shadow-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                        {STATUSES.map((item) => <SelectItem key={item} value={item} className="text-xs capitalize">{item.replaceAll("_", " ")}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            {isLoading ? (
                <Skeleton className="h-[240px] w-full rounded-lg" />
            ) : error ? (
                <p className="rounded-lg border border-border/40 bg-muted/30 px-5 py-12 text-center text-xs text-muted-foreground">{error instanceof Error ? error.message : "Could not load runs."}</p>
            ) : (
                <RunsTable runs={runs} tenants={data.tenants} />
            )}
            {(offset > 0 || runs.length === PAGE_SIZE) && (
                <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
                    <span className="tabular-nums">{offset + 1}–{offset + runs.length}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Previous page" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Next page" disabled={runs.length < PAGE_SIZE} onClick={() => setOffset(offset + PAGE_SIZE)}>
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}
        </div>
    );
}

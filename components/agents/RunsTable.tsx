"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Status, type Run, type Tenant } from "@/components/agents/studio";
import { cn } from "@/lib/utils";

const HEAD_CLASS = "h-8 text-[10px] font-medium uppercase tracking-wider text-muted-foreground";

// Same "02 Jan 26 17:41:47" timestamp as the Logs table.
function formatDate(iso: string): string {
    const date = new Date(iso);
    const day = date.getDate().toString().padStart(2, "0");
    const month = date.toLocaleString("en-US", { month: "short" });
    const year = date.getFullYear().toString().slice(-2);
    const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    return `${day} ${month} ${year} ${time}`;
}

/** An agent's runs in the Logs table style. */
export function RunsTable({ runs, tenants }: { runs: Run[]; tenants: Tenant[] }) {
    const tenantName = (id: string | null) => tenants.find((tenant) => tenant.id === id)?.name ?? "Test run";
    return (
        <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/30">
            {runs.length === 0 ? (
                <p className="px-5 py-12 text-center text-xs text-muted-foreground">No runs yet. Customer activity appears here.</p>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-border/40 hover:bg-transparent">
                                <TableHead className={cn(HEAD_CLASS, "w-[180px] px-3")}>Time</TableHead>
                                <TableHead className={cn(HEAD_CLASS, "w-[200px]")}>Customer</TableHead>
                                <TableHead className={cn(HEAD_CLASS, "w-[120px]")}>Status</TableHead>
                                <TableHead className={cn(HEAD_CLASS, "pr-3")}>Error</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {runs.map((run) => (
                                <TableRow key={run.id} className="border-b border-border/40 last:border-b-0 hover:bg-muted/50">
                                    <TableCell className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">{formatDate(run.created_at)}</TableCell>
                                    <TableCell className="py-2 text-xs"><p className="max-w-[190px] truncate">{tenantName(run.tenant_id)}</p></TableCell>
                                    <TableCell className="py-2"><Status status={run.status} /></TableCell>
                                    <TableCell className="w-full max-w-0 py-2 pr-3 text-xs text-muted-foreground"><p className="truncate" title={run.error ?? undefined}>{run.error ?? "—"}</p></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}

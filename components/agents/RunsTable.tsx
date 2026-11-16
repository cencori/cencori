"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, type Run, type Tenant } from "@/components/agents/studio";
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

/** An agent's runs in the Logs table style. A row opens to the full prompt and reply. */
export function RunsTable({ runs, tenants }: { runs: Run[]; tenants: Tenant[] }) {
    const [openId, setOpenId] = useState<string | null>(null);
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
                                <TableHead className={cn(HEAD_CLASS, "pr-3")}>Prompt</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {runs.map((run) => {
                                const open = openId === run.id;
                                // A failed run with no prompt on record still says why it failed.
                                const summary = run.prompt ?? run.error ?? "—";
                                return (
                                    <Fragment key={run.id}>
                                        <TableRow
                                            className={cn("cursor-pointer border-b border-border/40 hover:bg-muted/50", open ? "bg-muted/50" : "last:border-b-0")}
                                            aria-expanded={open}
                                            tabIndex={0}
                                            onClick={() => setOpenId(open ? null : run.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    setOpenId(open ? null : run.id);
                                                }
                                            }}
                                        >
                                            <TableCell className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")} />
                                                    {formatDate(run.created_at)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2 text-xs"><p className="max-w-[190px] truncate">{tenantName(run.tenant_id)}</p></TableCell>
                                            <TableCell className="py-2"><StatusBadge status={run.status} /></TableCell>
                                            <TableCell className={cn("w-full max-w-0 py-2 pr-3 text-xs", run.prompt ? "text-foreground" : "text-muted-foreground")}>
                                                <p className="truncate">{summary}</p>
                                            </TableCell>
                                        </TableRow>
                                        {open && (
                                            <TableRow className="border-b border-border/40 bg-muted/20 last:border-b-0 hover:bg-muted/20">
                                                <TableCell colSpan={4} className="px-3 py-3">
                                                    <div className="grid gap-3 pl-[18px]">
                                                        <RunText label="Prompt" text={run.prompt} empty="No prompt was kept for this run." />
                                                        <RunText label="Reply" text={run.reply} empty={run.status === "completed" ? "No reply was kept for this run." : "This run did not produce a reply."} />
                                                        {run.error && <RunText label="Error" text={run.error} tone="error" />}
                                                        {run.model && <p className="font-mono text-[11px] text-muted-foreground">{run.model}</p>}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}

function RunText({ label, text, empty, tone }: { label: string; text?: string | null; empty?: string; tone?: "error" }) {
    return (
        <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            {text ? (
                <p className={cn("max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed", tone === "error" ? "text-destructive" : "text-foreground")}>{text}</p>
            ) : (
                <p className="text-xs text-muted-foreground">{empty}</p>
            )}
        </div>
    );
}

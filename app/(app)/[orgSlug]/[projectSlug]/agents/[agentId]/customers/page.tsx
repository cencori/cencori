"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { StatusBadge } from "@/components/agents/studio";
import { cn } from "@/lib/utils";

const HEAD_CLASS = "h-8 text-[10px] font-medium uppercase tracking-wider text-muted-foreground";

/** Which customers have this agent, and installing it for more. Customers are created by use (widget, WhatsApp) or through the API, not here. */
export default function AgentCustomersPage() {
    const { agent, data, canManage, busy, act } = useAgentWorkspace();
    const installs = new Map(data.installations.filter((item) => item.agent_id === agent.id).map((item) => [item.tenant_id, item] as const));
    const published = !!agent.stable_version_id;
    const [installing, setInstalling] = useState<string | null>(null);

    // Putting an agent on a website or WhatsApp creates a customer for that
    // agent's visitors ("widget:<agent id>"). Those belong to their own agent,
    // so another agent's visitors are not listed here unless it was installed for them.
    const channelOf = (externalId: string) => /^(widget|whatsapp):(.+)$/.exec(externalId);
    const tenants = data.tenants.filter((tenant) => {
        const channel = channelOf(tenant.external_id);
        return !channel || channel[2] === agent.id || installs.has(tenant.id);
    });

    const install = async (tenantId: string, tenantName: string) => {
        setInstalling(tenantId);
        try {
            const result = await act("install_agent", { agent_id: agent.id, tenant_id: tenantId });
            if (result) toast.success("Agent installed", { description: `${tenantName} can now use ${agent.name}.` });
        } finally {
            setInstalling(null);
        }
    };

    return (
        <div>
            <header className="mb-6">
                <h1 className="text-base font-medium">Customers</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">Who can use this agent. Website and WhatsApp visitors are added when you put the agent there; your own customers are added through the API.</p>
            </header>

            {!published && (
                <p className="mb-4 rounded-md border border-amber-500/25 px-4 py-3 text-xs text-amber-500">Publish a version before installing this agent for customers.</p>
            )}

            <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                {tenants.length === 0 ? (
                    <p className="px-5 py-12 text-center text-xs text-muted-foreground">No customers yet. They appear here once someone uses this agent, or when you create one through the API.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-border/40 hover:bg-transparent">
                                    <TableHead className={cn(HEAD_CLASS, "px-3")}>Customer</TableHead>
                                    <TableHead className={cn(HEAD_CLASS, "w-[220px]")}>ID in your app</TableHead>
                                    <TableHead className={cn(HEAD_CLASS, "w-[160px] pr-3 text-right")}>Access</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tenants.map((tenant) => {
                                    const installation = installs.get(tenant.id);
                                    return (
                                        <TableRow key={tenant.id} className="border-b border-border/40 last:border-b-0 hover:bg-muted/50">
                                            <TableCell className="w-full max-w-0 px-3 py-2 text-xs"><p className="truncate">{tenant.name}</p></TableCell>
                                            <TableCell className="py-2 font-mono text-xs text-muted-foreground"><p className="max-w-[210px] truncate">{tenant.external_id}</p></TableCell>
                                            <TableCell className="py-2 pr-3 text-right">
                                                {installation ? (
                                                    <StatusBadge status={installation.status === "active" ? "Installed" : installation.status} />
                                                ) : canManage && published && tenant.status === "active" && !channelOf(tenant.external_id) ? (
                                                    <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-xs" onClick={() => void install(tenant.id, tenant.name)} disabled={!!busy}>
                                                        {installing === tenant.id ? <Spinner className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                                        Install
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Not installed</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
    );
}

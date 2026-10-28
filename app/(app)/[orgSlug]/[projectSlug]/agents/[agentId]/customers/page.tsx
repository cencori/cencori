"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { Status } from "@/components/agents/studio";
import { cn } from "@/lib/utils";

const HEAD_CLASS = "h-8 text-[10px] font-medium uppercase tracking-wider text-muted-foreground";

/** Which customers have this agent, and installing it for more. */
export default function AgentCustomersPage() {
    const { agent, data, canManage, busy, act } = useAgentWorkspace();
    const [name, setName] = useState("");
    const [externalId, setExternalId] = useState("");
    const installs = new Map(data.installations.filter((item) => item.agent_id === agent.id).map((item) => [item.tenant_id, item] as const));
    const published = !!agent.stable_version_id;

    const install = async (tenantId: string, tenantName: string) => {
        const result = await act("install_agent", { agent_id: agent.id, tenant_id: tenantId });
        if (result) toast.success("Agent installed", { description: `${agent.name} is now available to ${tenantName}.` });
    };

    const addCustomer = async (event: React.FormEvent) => {
        event.preventDefault();
        const result = await act("create_tenant", { name, external_id: externalId });
        if (result) {
            setName("");
            setExternalId("");
            toast.success("Customer added", { description: "You can now install this agent for them." });
        }
    };

    return (
        <div>
            <header className="mb-6">
                <h1 className="text-base font-medium">Customers</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">Install this agent for a customer. Each keeps their own data and permissions.</p>
            </header>

            {!published && (
                <p className="mb-4 rounded-md border border-amber-500/25 px-4 py-3 text-xs text-amber-500">Publish a version before installing this agent for customers.</p>
            )}

            <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                {data.tenants.length === 0 ? (
                    <p className="px-5 py-12 text-center text-xs text-muted-foreground">No customers yet. Add one below to give them access.</p>
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
                                {data.tenants.map((tenant) => {
                                    const installation = installs.get(tenant.id);
                                    return (
                                        <TableRow key={tenant.id} className="border-b border-border/40 last:border-b-0 hover:bg-muted/50">
                                            <TableCell className="w-full max-w-0 px-3 py-2 text-xs"><p className="truncate">{tenant.name}</p></TableCell>
                                            <TableCell className="py-2 font-mono text-xs text-muted-foreground"><p className="max-w-[210px] truncate">{tenant.external_id}</p></TableCell>
                                            <TableCell className="py-2 pr-3 text-right">
                                                {installation ? (
                                                    <Status status={installation.status} />
                                                ) : canManage && published && tenant.status === "active" ? (
                                                    <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-xs" onClick={() => void install(tenant.id, tenant.name)} disabled={!!busy}>
                                                        {busy === "install_agent" ? <Spinner className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
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

            {canManage && (
                <form onSubmit={addCustomer} className="mt-6 rounded-lg border border-border/40 bg-muted/30 p-5">
                    <h2 className="text-sm font-medium">Add a customer</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">Use the same customer ID your application uses.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Customer name, e.g. Northstar Health" className="h-9 text-sm shadow-none" />
                        <Input value={externalId} onChange={(event) => setExternalId(event.target.value)} placeholder="Customer ID, e.g. northstar-health" className="h-9 font-mono text-sm shadow-none" />
                    </div>
                    <Button type="submit" size="sm" className="mt-4 h-7 gap-1 text-xs" disabled={!name.trim() || !externalId.trim() || !!busy}>
                        {busy === "create_tenant" ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Add customer
                    </Button>
                </form>
            )}
        </div>
    );
}

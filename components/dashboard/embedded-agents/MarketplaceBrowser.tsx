"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Store } from "lucide-react";

type MarketplaceAgent = {
    version_id: string;
    agent_id: string;
    version: string;
    name: string | null;
    description: string | null;
    requirements?: Record<string, unknown>;
    published_at: string | null;
};

type Tenant = { id: string; name: string; external_id: string; status: string };

async function fetchMarketplace(cursor: string | null): Promise<{ data: MarketplaceAgent[]; next_cursor: string | null }> {
    const params = new URLSearchParams({ limit: "20" });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/v1/marketplace/agents?${params.toString()}`);
    if (!response.ok) throw new Error("We couldn't load the marketplace.");
    return response.json() as Promise<{ data: MarketplaceAgent[]; next_cursor: string | null }>;
}

export function MarketplaceBrowser({ projectId, tenants, canManage }: { projectId: string; tenants: Tenant[]; canManage: boolean }) {
    const queryClient = useQueryClient();
    const [pages, setPages] = useState<Array<{ data: MarketplaceAgent[]; next_cursor: string | null }>>([]);
    const [loading, setLoading] = useState(false);
    const [started, setStarted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [installTenant, setInstallTenant] = useState<string>("");
    const [installingId, setInstallingId] = useState<string | null>(null);

    const agents = pages.flatMap((page) => page.data);
    const nextCursor = pages.length > 0 ? pages[pages.length - 1].next_cursor : null;

    async function loadMore(cursor: string | null) {
        setLoading(true);
        setError(null);
        try {
            const page = await fetchMarketplace(cursor);
            setPages((current) => [...current, page]);
            setStarted(true);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "We couldn't load the marketplace.");
        } finally {
            setLoading(false);
        }
    }

    async function install(agent: MarketplaceAgent) {
        if (!installTenant) {
            setError("Choose a customer to install this agent for.");
            return;
        }
        setInstallingId(agent.version_id);
        setError(null);
        try {
            const response = await fetch(`/api/projects/${projectId}/marketplace/installations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ version_id: agent.version_id, tenant_id: installTenant }),
            });
            const payload = await response.json().catch(() => ({})) as { error?: string };
            if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Install failed. Try again.");
            await queryClient.invalidateQueries({ queryKey: ["embedded-agent-studio", projectId] });
            setExpandedId(null);
            toast.success("Agent installed", { description: `${agent.name ?? "The agent"} was forked into your project.` });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Install failed. Try again.");
        } finally {
            setInstallingId(null);
        }
    }

    return (
        <div className="max-w-4xl">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold">Marketplace</h3>
                    <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
                        Browse public agents built by others. Installing one forks a private copy into your project — later edits by the publisher never move it, and spend bills to you.
                    </p>
                </div>
                <Store className="h-5 w-5 text-muted-foreground" />
            </div>
            {!started && !loading && (
                <button
                    type="button"
                    onClick={() => void loadMore(null)}
                    className="mt-6 rounded-md border border-border px-3.5 py-2 text-xs font-medium hover:bg-accent"
                >
                    Browse public agents
                </button>
            )}
            {loading && pages.length === 0 && <p className="mt-6 text-xs text-muted-foreground">Loading the marketplace…</p>}
            {error && <p role="alert" className="mt-6 text-xs text-destructive">{error}</p>}
            {agents.length > 0 && (
                <div className="mt-7 divide-y divide-border border-y border-border">
                    {agents.map((agent) => (
                        <div key={agent.version_id} className="py-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground">
                                    {(agent.name ?? "?").slice(0, 1).toUpperCase()}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{agent.name ?? "Untitled agent"}</p>
                                    <p className="truncate text-xs text-muted-foreground">{agent.description ?? `Version ${agent.version}`}</p>
                                </div>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === agent.version_id ? null : agent.version_id)} className="h-7 px-3 text-[11px]">
                                    {expandedId === agent.version_id ? "Hide" : "Details"}
                                </Button>
                            </div>
                            {expandedId === agent.version_id && (
                                <div className="mt-3 rounded-md border border-border/60 bg-muted/20 px-4 py-3">
                                    {agent.description && <p className="text-xs leading-5 text-muted-foreground">{agent.description}</p>}
                                    <p className="mt-2 text-[11px] text-muted-foreground">Version {agent.version}{agent.published_at ? ` · published ${new Date(agent.published_at).toLocaleDateString()}` : ""}</p>
                                    {canManage ? (
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <select
                                                value={installTenant}
                                                onChange={(event) => setInstallTenant(event.target.value)}
                                                className="h-8 rounded-md border border-border/70 bg-background px-2 text-xs"
                                                aria-label="Customer to install for"
                                            >
                                                <option value="">Choose a customer…</option>
                                                {tenants.filter((tenant) => tenant.status === "active").map((tenant) => (
                                                    <option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.external_id})</option>
                                                ))}
                                            </select>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => void install(agent)}
                                                disabled={installingId !== null}
                                                className="h-8 px-3 text-[11px]"
                                            >
                                                {installingId === agent.version_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                                <span className="ml-1">Install a copy</span>
                                            </Button>
                                        </div>
                                    ) : (
                                        <p className="mt-3 text-[11px] text-muted-foreground">Ask a project admin to install this agent.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {started && agents.length === 0 && !loading && <p className="mt-6 text-xs text-muted-foreground">No public agents yet. Publish one with visibility set to Public.</p>}
            {nextCursor && (
                <button
                    type="button"
                    onClick={() => void loadMore(nextCursor)}
                    disabled={loading}
                    className="mt-4 rounded-md border border-border px-3.5 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
                >
                    {loading ? "Loading…" : "Load more"}
                </button>
            )}
        </div>
    );
}

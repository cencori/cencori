"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import PlugSocketIcon from "@hugeicons/core-free-icons/PlugSocketIcon";
import { ChevronDown, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { DockedPanel } from "@/components/agents/DockedPanel";
import { ServerIcon } from "@/components/agents/AgentMcp";
import { postStudioAction, studioQueryKey } from "@/components/agents/studio";
import { cn } from "@/lib/utils";

type AppTool = { name: string; description: string; readOnly: boolean; destructive: boolean };
/** A connected app as stored on the agent. */
type AgentApp = { id: string; name: string; tools: AppTool[]; enabled: string[]; icon?: string; nango?: { integration: string } };
type CatalogApp = { id: string; name: string; provider: string; logo: string | null };
type Connection = { connectionId: string; integration: string; broken: boolean };
type AppsPayload = { configured: boolean; catalog: CatalogApp[]; connections: Connection[] };

const inputClass = "w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring disabled:cursor-not-allowed disabled:opacity-60";
/** How long to wait for a sign-in to show up as a connection. */
const CONNECT_WAIT_MS = 5 * 60_000;
const CONNECT_POLL_MS = 2_000;

const appsQueryKey = (projectId: string) => ["agent-integrations", projectId];

/** A window opened on the click (so it isn't blocked), pointed at the app's sign-in once we have it. */
function openConnectWindow(appName: string): Window | null {
    const width = 520;
    const height = 720;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const popup = window.open("", "cencori-integration-connect", `width=${width},height=${height},left=${left},top=${top}`);
    if (!popup) return null;
    try {
        popup.document.title = "Connecting…";
        popup.document.body.style.cssText = "margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font:14px -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#666";
        popup.document.body.textContent = `Opening ${appName}…`;
    } catch {
        // A window left from an earlier connect may be on another site; it's reused as is.
    }
    return popup;
}

/**
 * The agent's connected apps: business accounts (Google Calendar, WhatsApp,
 * Instagram…) connected once per project, and the tools of each the agent
 * may use. The page header owns the Add integration button once apps exist.
 */
export function AgentIntegrations({ adding, onAddingChange }: { adding: boolean; onAddingChange: (adding: boolean) => void }) {
    const { projectId, agent, version, editable, canManage, busy } = useAgentWorkspace();
    const queryClient = useQueryClient();
    const apps = ((version?.config_json.integrations ?? []) as AgentApp[]).filter((app) => app && typeof app.id === "string" && app.nango);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [working, setWorking] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const popupRef = useRef<Window | null>(null);
    const cancelled = useRef(false);
    const canEdit = canManage && editable;
    const locked = !canEdit || !!busy || !!working;

    const appsQuery = useQuery({
        queryKey: appsQueryKey(projectId),
        queryFn: async () => postStudioAction(projectId, "integrations_list") as Promise<AppsPayload>,
        staleTime: 30_000,
    });
    const catalog = appsQuery.data?.catalog ?? [];
    const connections = appsQuery.data?.connections ?? [];
    const connected = (integration: string) => connections.some((c) => c.integration === integration);
    const brokenFor = (integration: string) => connections.some((c) => c.integration === integration && c.broken);
    const logoFor = (integration: string) => catalog.find((app) => app.id === integration)?.logo ?? null;

    useEffect(() => {
        if (!adding) return;
        setQuery("");
        setError(null);
    }, [adding]);
    useEffect(() => () => { cancelled.current = true; }, []);

    const refetchAgent = () => queryClient.invalidateQueries({ queryKey: studioQueryKey(projectId) });

    /** Add (or refresh) the app on this agent's draft, once the project has it connected. */
    const attach = async (integration: string, name: string, refreshing = false) => {
        if (!version) return;
        const result = await postStudioAction(projectId, "integration_attach", { agent_id: agent.id, version_id: version.id, integration }) as { integration?: AgentApp };
        await refetchAgent();
        const app = result.integration;
        toast.success(refreshing ? `${name} refreshed` : `${name} added`, app ? { description: `${app.enabled.length} of ${app.tools.length} tools on.` } : undefined);
    };

    /** Pick an app in the catalog: connect it if the project hasn't, then add it to the agent. */
    const pick = async (app: CatalogApp) => {
        setError(null);
        setWorking(app.id);
        // Opened during the click; closed straight away if no sign-in is needed.
        const needsSignIn = !connected(app.id) || brokenFor(app.id);
        const popup = needsSignIn ? openConnectWindow(app.name) : null;
        try {
            if (needsSignIn) {
                if (!popup) throw new Error("Your browser blocked the sign-in window. Allow pop-ups for this site and try again.");
                const { url } = await postStudioAction(projectId, "integration_connect", { integration: app.id }) as { url: string };
                popup.location.href = url;
                popupRef.current = popup;
                const started = Date.now();
                const before = new Set(connections.filter((c) => c.integration === app.id).map((c) => c.connectionId));
                // The sign-in page closes or finishes on its own; watch for the new connection.
                for (;;) {
                    if (cancelled.current) return;
                    await new Promise((resolve) => setTimeout(resolve, CONNECT_POLL_MS));
                    const fresh = await queryClient.fetchQuery({ queryKey: appsQueryKey(projectId), queryFn: async () => postStudioAction(projectId, "integrations_list") as Promise<AppsPayload>, staleTime: 0 });
                    if (fresh.connections.some((c) => c.integration === app.id && !before.has(c.connectionId))) break;
                    const closed = !popupRef.current || popupRef.current.closed;
                    if ((closed && Date.now() - started > CONNECT_POLL_MS * 3) || Date.now() - started > CONNECT_WAIT_MS) {
                        throw new Error(`${app.name} wasn't connected. Try again when you're ready.`);
                    }
                }
                popupRef.current?.close();
            }
            await attach(app.id, app.name);
            onAddingChange(false);
        } catch (cause) {
            popup?.close();
            setError(cause instanceof Error ? cause.message : `Couldn't add ${app.name}.`);
        } finally {
            setWorking(null);
        }
    };

    const saveApps = async (next: AgentApp[], message: string) => {
        if (!version) return;
        setWorking("save");
        setError(null);
        try {
            await postStudioAction(projectId, "save_tools", { agent_id: agent.id, version_id: version.id, integrations: next.map(({ id, name, enabled }) => ({ id, name, enabled })) });
            await refetchAgent();
            if (message) toast.success(message);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't save. Try again.");
        } finally {
            setWorking(null);
        }
    };

    const refresh = async (app: AgentApp) => {
        setWorking(app.id);
        setError(null);
        try {
            await attach(app.nango!.integration, app.name, true);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : `Couldn't refresh ${app.name}.`);
        } finally {
            setWorking(null);
        }
    };

    const toggleExpanded = (id: string) => setExpanded((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const visible = catalog.filter((app) => !query.trim() || app.name.toLowerCase().includes(query.trim().toLowerCase()));
    const notConfigured = appsQuery.data && !appsQuery.data.configured;

    return (
        <div className="space-y-4">
            {apps.length === 0 ? (
                <div className="flex flex-col items-center rounded-lg border border-border/60 px-6 py-14 text-center">
                    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/70 text-foreground"><HugeiconsIcon icon={PlugSocketIcon} className="h-5 w-5" /></span>
                    <p className="text-sm font-medium">No integrations yet</p>
                    <p className="mt-1 max-w-[42ch] text-xs leading-5 text-muted-foreground">
                        Connect the apps the business already uses, like its calendar or WhatsApp, and {agent.name} can work in them.
                    </p>
                    {canEdit && !notConfigured && (
                        <Button size="sm" className="mt-4 h-7 gap-1.5 text-xs" onClick={() => onAddingChange(true)} disabled={locked}>
                            <Plus className="h-3.5 w-3.5" />
                            Add integration
                        </Button>
                    )}
                    {notConfigured && <p className="mt-4 text-[11px] text-muted-foreground">Integrations aren&apos;t set up on this server yet.</p>}
                </div>
            ) : (
                <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
                    {apps.map((app) => {
                        const integration = app.nango!.integration;
                        const isOpen = expanded.has(app.id);
                        const broken = brokenFor(integration) || (appsQuery.data && !connected(integration));
                        return (
                            <section key={app.id}>
                                <header className={cn("flex items-center gap-3 px-4 py-3", isOpen && "border-b border-border/60")}>
                                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => toggleExpanded(app.id)} aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} ${app.name} tools`}>
                                        <ServerIcon icon={app.icon ?? logoFor(integration) ?? undefined} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{app.name}</span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {app.enabled.length} of {app.tools.length} tools on{broken ? " · needs reconnecting" : " · connected"}
                                            </span>
                                        </span>
                                        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                                    </button>
                                    {canEdit && (
                                        <div className="flex shrink-0 items-center gap-1">
                                            {broken && (
                                                <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => { const catalogApp = catalog.find((c) => c.id === integration); if (catalogApp) void pick(catalogApp); }} disabled={locked}>
                                                    Reconnect
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => void refresh(app)} disabled={locked} aria-label={`Refresh ${app.name} tools`} title="Refresh tools">
                                                <RefreshCw className={cn("h-3.5 w-3.5", working === app.id && "animate-spin")} />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void saveApps(apps.filter((a) => a.id !== app.id), `${app.name} removed`)} disabled={locked} aria-label={`Remove ${app.name}`} title="Remove from this agent">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                </header>
                                {isOpen && (
                                    <ul className="divide-y divide-border/60">
                                        {app.tools.map((tool) => (
                                            <li key={tool.name} className="flex items-start justify-between gap-4 px-4 py-2.5">
                                                <div className="min-w-0">
                                                    <p className="flex items-center gap-2">
                                                        <span className="truncate font-mono text-[13px]">{tool.name.replace(`${integration}__`, "")}</span>
                                                        {tool.destructive && <span className="shrink-0 rounded-[4px] border border-destructive/30 px-1.5 text-[10px] text-destructive">Can delete</span>}
                                                    </p>
                                                    {tool.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{tool.description}</p>}
                                                </div>
                                                <Switch
                                                    checked={app.enabled.includes(tool.name)}
                                                    disabled={locked}
                                                    aria-label={tool.name}
                                                    onCheckedChange={(checked) => void saveApps(apps.map((a) => (a.id === app.id ? { ...a, enabled: checked ? [...a.enabled, tool.name] : a.enabled.filter((n) => n !== tool.name) } : a)), "")}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
            {error && !adding && <p role="alert" className="text-xs text-destructive">{error}</p>}

            <DockedPanel open={adding} onOpenChange={(next) => { if (!next && !working) onAddingChange(false); }}>
                <SheetHeader className="border-b border-border/60 px-5 py-4">
                    <SheetTitle className="text-base font-medium">Add integration</SheetTitle>
                    <SheetDescription className="text-xs">Connect the app your business uses.</SheetDescription>
                </SheetHeader>
                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                    <label className="relative block">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search apps" aria-label="Search apps" className={cn(inputClass, "pl-8")} />
                    </label>
                    {appsQuery.isLoading ? (
                        <div className="flex justify-center py-10 text-muted-foreground"><HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" /></div>
                    ) : visible.length === 0 ? (
                        <p className="py-8 text-center text-xs text-muted-foreground">{catalog.length === 0 ? "No apps are available yet." : "No apps match."}</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {visible.map((app) => {
                                const onAgent = apps.some((a) => a.nango?.integration === app.id);
                                return (
                                    <button
                                        key={app.id}
                                        type="button"
                                        onClick={() => void pick(app)}
                                        disabled={locked || onAgent}
                                        className="flex items-center gap-2.5 rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/40 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                                    >
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/70">
                                            {working === app.id
                                                ? <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin text-muted-foreground" />
                                                // eslint-disable-next-line @next/next/no-img-element -- the app's logo from the integrations catalog
                                                : app.logo ? <img src={app.logo} alt="" className="h-5 w-5 object-contain" /> : <HugeiconsIcon icon={PlugSocketIcon} className="h-4 w-4" />}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm">{app.name}</span>
                                            <span className="block truncate text-[11px] text-muted-foreground">
                                                {working === app.id ? "Waiting for sign-in…" : onAgent ? "Added" : connected(app.id) ? "Connected" : "Connect"}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
                </div>
            </DockedPanel>
        </div>
    );
}

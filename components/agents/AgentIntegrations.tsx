"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import PlugSocketIcon from "@hugeicons/core-free-icons/PlugSocketIcon";
import { ArrowLeft, ChevronDown, Plus, RefreshCw, Search, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { DockedPanel } from "@/components/agents/DockedPanel";
import { ServerIcon } from "@/components/agents/AgentMcp";
import { AgentCatalog, catalogQueryKey, startCatalog, useCatalog } from "@/components/agents/AgentCatalog";
import { applyStudioResult, postStudioAction } from "@/components/agents/studio";
import { readJson } from "@/components/agents/widget-preview";
import { cn } from "@/lib/utils";

type AppTool = { name: string; description: string; readOnly: boolean; destructive: boolean };
/** A connected app as stored on the agent. */
type AgentApp = { id: string; name: string; tools: AppTool[]; enabled: string[]; icon?: string; nango?: { integration: string } };
type CatalogApp = { id: string; name: string; provider: string; logo: string | null; categories?: string[] };
type Connection = { connectionId: string; integration: string; broken: boolean };
/** An app signed in to through its own MCP server (Bumpa…); not available until its address is set. */
type McpApp = { id: string; name: string; domain: string; category: string; url: string | null; available: boolean };
type AppsPayload = { configured: boolean; catalog: CatalogApp[]; connections: Connection[]; mcp_apps?: McpApp[] };
/** An MCP server on the agent, as stored. */
type AgentServer = { id: string; name: string; url: string; tools: unknown[]; enabled: string[] };
type SignInMessage = { type: "cencori:mcp-oauth"; ok: boolean; name?: string; on?: number; total?: number; error?: string };

const inputClass = "w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring disabled:cursor-not-allowed disabled:opacity-60";
/** How long to wait for a sign-in to show up as a connection. */
const CONNECT_WAIT_MS = 5 * 60_000;
const CONNECT_POLL_MS = 2_000;

const appsQueryKey = (projectId: string) => ["agent-integrations", projectId];
const paymentsQueryKey = (projectId: string) => ["project-payments", projectId];

type PaymentProviderInfo = { id: string; name: string; key_help: string; key_placeholder: string; available: boolean };
type ProjectPayment = { reference: string; amount: number; currency: string; description: string; status: "pending" | "paid" | "expired"; created_at: string; paid_at: string | null; customer: string | null };
type PaymentsPayload = {
    providers: PaymentProviderInfo[];
    payments: { provider: string; provider_name: string; mode: "live" | "test"; currency: string; connected_at: string; recent: ProjectPayment[] } | null;
    can_manage: boolean;
};

const PROVIDER_DOMAINS: Record<string, string> = { paystack: "paystack.com", flutterwave: "flutterwave.com", stripe: "stripe.com", bachs: "bachs.io" };
const faviconFor = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
const providerLogo = (id: string) => faviconFor(PROVIDER_DOMAINS[id] ?? `${id}.com`);

/** How the catalog is grouped, from the apps' own categories; the first group that matches wins. */
const APP_GROUPS: Array<{ id: string; label: string; match: string[] }> = [
    { id: "productivity", label: "Calendar & productivity", match: ["productivity"] },
    { id: "messaging", label: "Messaging", match: ["communication"] },
    { id: "social", label: "Social & marketing", match: ["social", "marketing"] },
    { id: "commerce", label: "Commerce", match: ["e-commerce", "payment"] },
    { id: "customers", label: "Customers & support", match: ["crm", "support", "ticketing"] },
];
const groupOf = (app: CatalogApp) => APP_GROUPS.find((group) => app.categories?.some((category) => group.match.includes(category)))?.id ?? "other";

function formatMoney(amount: number, currency: string) {
    try {
        return new Intl.NumberFormat("en-NG", { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
    } catch {
        return `${currency} ${amount}`;
    }
}

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
    const signInPopupRef = useRef<Window | null>(null);
    const cancelled = useRef(false);
    const canEdit = canManage && editable;
    const locked = !canEdit || !!busy || !!working;

    const paymentsEndpoint = `/api/projects/${projectId}/payments`;
    const paymentsQuery = useQuery({
        queryKey: paymentsQueryKey(projectId),
        queryFn: async () => readJson<PaymentsPayload>(await fetch(paymentsEndpoint, { cache: "no-store" })),
        staleTime: 30_000,
    });
    const payments = paymentsQuery.data?.payments ?? null;
    const paymentProviders = paymentsQuery.data?.providers ?? [];
    const takePaymentsOn = !!(version?.config_json.system_tools as { take_payments?: unknown } | undefined)?.take_payments;
    // Adding a payment provider: its key form takes over the panel.
    const [paymentForm, setPaymentForm] = useState<PaymentProviderInfo | null>(null);
    const [paymentKey, setPaymentKey] = useState("");

    const catalogQuery = useCatalog(projectId);
    const hasCatalog = !!catalogQuery.data?.catalog;

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
    const mcpApps = appsQuery.data?.mcp_apps ?? [];
    const servers = ((version?.config_json.mcp_servers ?? []) as AgentServer[]).filter((server) => server && typeof server.id === "string");
    const serverFor = (app: McpApp) => (app.url ? servers.find((server) => server.url.replace(/\/$/, "") === app.url!.replace(/\/$/, "")) ?? null : null);
    const connectedMcpApps = mcpApps.map((app) => ({ app, server: serverFor(app) })).filter((entry): entry is { app: McpApp; server: AgentServer } => !!entry.server);

    useEffect(() => {
        if (!adding) return;
        setQuery("");
        setError(null);
        setPaymentForm(null);
        setPaymentKey("");
    }, [adding]);
    useEffect(() => () => { cancelled.current = true; }, []);

    // Show the saved draft from the response; the full reload runs in the background.
    const refetchAgent = (result?: Record<string, unknown> | null) => applyStudioResult(queryClient, projectId, result);

    /** Add (or refresh) the app on this agent's draft, once the project has it connected. */
    const attach = async (integration: string, name: string, refreshing = false) => {
        if (!version) return;
        const result = await postStudioAction(projectId, "integration_attach", { agent_id: agent.id, version_id: version.id, integration }) as { integration?: AgentApp };
        refetchAgent(result as Record<string, unknown>);
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

    /** Sign in to an app's own MCP server in a popup; the callback page reports back with a message. */
    const signInApp = async (app: McpApp) => {
        if (!version) return;
        setError(null);
        setWorking(app.id);
        const popup = openConnectWindow(app.name);
        try {
            if (!popup) throw new Error("Your browser blocked the sign-in window. Allow pop-ups for this site and try again.");
            const { authorize_url: url } = await postStudioAction(projectId, "mcp_oauth_start", { agent_id: agent.id, version_id: version.id, app: app.id }) as { authorize_url: string };
            popup.location.href = url;
            signInPopupRef.current = popup;
        } catch (cause) {
            popup?.close();
            setWorking(null);
            setError(cause instanceof Error ? cause.message : `Couldn't start signing in to ${app.name}.`);
        }
    };

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || (event.data as SignInMessage | null)?.type !== "cencori:mcp-oauth") return;
            const result = event.data as SignInMessage;
            setWorking(null);
            if (!result.ok) {
                setError(result.error ?? "Sign-in didn't complete.");
                return;
            }
            void refetchAgent();
            onAddingChange(false);
            toast.success(`${result.name} connected`, { description: `${result.on} of ${result.total} tools on.` });
        };
        window.addEventListener("message", onMessage);
        // Stop waiting if the sign-in window is closed without finishing.
        const poll = window.setInterval(() => {
            if (signInPopupRef.current?.closed) {
                signInPopupRef.current = null;
                setWorking(null);
            }
        }, 800);
        return () => {
            window.removeEventListener("message", onMessage);
            window.clearInterval(poll);
        };
    }, [onAddingChange]); // eslint-disable-line react-hooks/exhaustive-deps

    const removeServer = async (server: AgentServer, name: string) => {
        if (!version) return;
        setWorking(server.id);
        setError(null);
        try {
            refetchAgent(await postStudioAction(projectId, "save_tools", { agent_id: agent.id, version_id: version.id, mcp_servers: servers.filter((s) => s.id !== server.id).map(({ id, name: serverName, enabled }) => ({ id, name: serverName, enabled })) }));
            toast.success(`${name} removed`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't remove it. Try again.");
        } finally {
            setWorking(null);
        }
    };

    const saveApps = async (next: AgentApp[], message: string) => {
        if (!version) return;
        setWorking("save");
        setError(null);
        try {
            refetchAgent(await postStudioAction(projectId, "save_tools", { agent_id: agent.id, version_id: version.id, integrations: next.map(({ id, name, enabled }) => ({ id, name, enabled })) }));
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

    /** Connect the project's payment provider, and switch Take payments on for this agent's draft. */
    const connectPayments = async (provider: PaymentProviderInfo) => {
        setError(null);
        setWorking(`pay:${provider.id}`);
        try {
            const result = await readJson<PaymentsPayload>(await fetch(paymentsEndpoint, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider: provider.id, secret_key: paymentKey }),
            }));
            queryClient.setQueryData(paymentsQueryKey(projectId), result);
            setPaymentKey("");
            let note = takePaymentsOn ? `${agent.name} can take payments.` : "";
            if (!takePaymentsOn && version && editable) {
                const current = (version.config_json.system_tools ?? {}) as Record<string, unknown>;
                refetchAgent(await postStudioAction(projectId, "save_tools", { agent_id: agent.id, version_id: version.id, system_tools: { ...current, take_payments: {} } }));
                note = "Take payments is on in this draft. Publish to make it live.";
            } else if (!takePaymentsOn) {
                note = "Turn on Take payments under Tools in a new draft.";
            }
            toast.success(`${provider.name} connected`, { description: note });
            setPaymentForm(null);
            onAddingChange(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : `Couldn't connect ${provider.name}.`);
        } finally {
            setWorking(null);
        }
    };

    const disconnectPayments = async () => {
        setError(null);
        setWorking("pay:disconnect");
        try {
            const result = await readJson<PaymentsPayload>(await fetch(paymentsEndpoint, { method: "DELETE" }));
            queryClient.setQueryData(paymentsQueryKey(projectId), result);
            toast.success("Payments disconnected");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't disconnect. Try again.");
        } finally {
            setWorking(null);
        }
    };

    /** The business's own product list, sold from by its agents. */
    const addCatalog = async () => {
        setError(null);
        setWorking("catalog");
        try {
            const { payload, note } = await startCatalog(projectId, agent.id, version ?? null, editable);
            queryClient.setQueryData(catalogQueryKey(projectId), payload);
            refetchAgent();
            toast.success("Products added", { description: note || "Add your products, or import a spreadsheet." });
            onAddingChange(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't add products.");
        } finally {
            setWorking(null);
        }
    };

    const toggleExpanded = (id: string) => setExpanded((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const term = query.trim().toLowerCase();
    const visible = catalog.filter((app) => !term || app.name.toLowerCase().includes(term));
    const visibleProviders = paymentProviders.filter((provider) => !term || provider.name.toLowerCase().includes(term) || "payments".includes(term));
    const showCatalogTile = !term || "products catalog shop store sell orders".includes(term);
    const visibleMcpApps = mcpApps.filter((app) => !term || app.name.toLowerCase().includes(term));
    const groups = [...APP_GROUPS, { id: "other", label: "Other apps", match: [] }]
        .map((group) => ({ ...group, apps: visible.filter((app) => groupOf(app) === group.id) }))
        .filter((group) => group.apps.length > 0 || (group.id === "commerce" && showCatalogTile) || visibleMcpApps.some((app) => app.category === group.id));
    const notConfigured = appsQuery.data && !appsQuery.data.configured;

    return (
        <div className="space-y-4">
            {payments && (
                <div className="overflow-hidden rounded-lg border border-border/60">
                    <header className={cn("flex items-center gap-3 px-4 py-3", expanded.has("payments") && "border-b border-border/60")}>
                        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => toggleExpanded("payments")} aria-expanded={expanded.has("payments")} aria-label={`${expanded.has("payments") ? "Hide" : "Show"} recent payments`}>
                            <ServerIcon icon={providerLogo(payments.provider)} />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{payments.provider_name}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                    Payments in {payments.currency}{payments.mode === "test" ? " · test mode" : ""} · {takePaymentsOn ? "Take payments on" : "Take payments off (turn it on under Tools)"}
                                </span>
                            </span>
                            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded.has("payments") && "rotate-180")} />
                        </button>
                        {canEdit && paymentsQuery.data?.can_manage && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void disconnectPayments()} disabled={locked} aria-label={`Disconnect ${payments.provider_name}`} title="Disconnect">
                                {working === "pay:disconnect" ? <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                        )}
                    </header>
                    {expanded.has("payments") && (
                        payments.recent.length === 0
                            ? <p className="px-4 py-3 text-xs text-muted-foreground">No payments yet. Links {agent.name} sends show up here.</p>
                            : (
                                <ul className="divide-y divide-border/60">
                                    {payments.recent.map((payment) => (
                                        <li key={payment.reference} className="flex items-start justify-between gap-4 px-4 py-2.5 text-xs">
                                            <span className="min-w-0">
                                                <span className="font-medium">{formatMoney(payment.amount, payment.currency)}</span> · {payment.description}
                                                {payment.customer && <span className="block text-[11px] text-muted-foreground">{payment.customer}</span>}
                                            </span>
                                            <span className={cn("shrink-0 text-[11px]", payment.status === "paid" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                                                {payment.status === "paid" ? "Paid" : payment.status === "pending" ? "Waiting" : "Expired"} · {new Date(payment.paid_at ?? payment.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )
                    )}
                </div>
            )}
            <AgentCatalog />
            {connectedMcpApps.length > 0 && (
                <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
                    {connectedMcpApps.map(({ app, server }) => (
                        <header key={server.id} className="flex items-center gap-3 px-4 py-3">
                            <ServerIcon icon={faviconFor(app.domain)} />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{app.name}</span>
                                <span className="block truncate text-xs text-muted-foreground">{server.enabled.length} of {server.tools.length} tools on · signed in · tools under MCP</span>
                            </span>
                            {canEdit && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void removeServer(server, app.name)} disabled={locked} aria-label={`Remove ${app.name}`} title="Remove from this agent">
                                    {working === server.id ? <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </Button>
                            )}
                        </header>
                    ))}
                </div>
            )}
            {apps.length === 0 && !payments && !hasCatalog && connectedMcpApps.length === 0 ? (
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
            ) : apps.length === 0 ? (
                canEdit && !notConfigured && (
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => onAddingChange(true)} disabled={locked}>
                        <Plus className="h-3.5 w-3.5" />
                        Add integration
                    </Button>
                )
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
                <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                    {paymentForm ? (
                        <div className="space-y-4">
                            <button type="button" onClick={() => { setPaymentForm(null); setError(null); }} className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                                <ArrowLeft className="h-3.5 w-3.5" /> All apps
                            </button>
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/70">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- the provider's favicon */}
                                    <img src={providerLogo(paymentForm.id)} alt="" className="h-6 w-6 object-contain" />
                                </span>
                                <div>
                                    <p className="text-sm font-medium">Connect {paymentForm.name}</p>
                                    <p className="text-xs text-muted-foreground">Payments go straight to your {paymentForm.name} account.</p>
                                </div>
                            </div>
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-medium">Secret key</span>
                                <input type="password" autoComplete="off" value={paymentKey} onChange={(event) => setPaymentKey(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && paymentKey.trim()) void connectPayments(paymentForm); }} placeholder={paymentForm.key_placeholder} autoFocus className={cn(inputClass, "font-mono")} />
                                <span className="mt-1.5 block text-[11px] leading-4 text-muted-foreground">{paymentForm.key_help}</span>
                            </label>
                            {payments && payments.provider !== paymentForm.id && (
                                <p className="rounded-md bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">This replaces {payments.provider_name}: the project takes payments through one provider at a time.</p>
                            )}
                            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
                            <Button size="sm" className="h-8 w-full gap-1.5 text-xs" disabled={!paymentKey.trim() || !!working || !paymentsQuery.data?.can_manage} onClick={() => void connectPayments(paymentForm)}>
                                {working === `pay:${paymentForm.id}` && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                                Connect {paymentForm.name}
                            </Button>
                            {!paymentsQuery.data?.can_manage && <p className="text-[11px] text-muted-foreground">Only project admins can connect payments.</p>}
                        </div>
                    ) : (
                        <>
                            <label className="relative block">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search apps" aria-label="Search apps" className={cn(inputClass, "pl-8")} />
                            </label>
                            {visibleProviders.length > 0 && (
                                <section>
                                    <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Payments</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {visibleProviders.map((provider) => {
                                            const isConnected = payments?.provider === provider.id;
                                            return (
                                                <button
                                                    key={provider.id}
                                                    type="button"
                                                    onClick={() => { setError(null); setPaymentForm(provider); }}
                                                    disabled={!provider.available || isConnected || locked}
                                                    className="flex items-center gap-2.5 rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/40 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                                                >
                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/70">
                                                        {/* eslint-disable-next-line @next/next/no-img-element -- the provider's favicon */}
                                                        <img src={providerLogo(provider.id)} alt="" className="h-5 w-5 object-contain" />
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-sm">{provider.name}</span>
                                                        <span className="block truncate text-[11px] text-muted-foreground">{!provider.available ? "Coming soon" : isConnected ? "Connected" : "Connect"}</span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}
                            {appsQuery.isLoading ? (
                                <div className="flex justify-center py-10 text-muted-foreground"><HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" /></div>
                            ) : groups.length === 0 && visibleProviders.length === 0 ? (
                                <p className="py-8 text-center text-xs text-muted-foreground">{catalog.length === 0 && paymentProviders.length === 0 ? "No apps are available yet." : "No apps match."}</p>
                            ) : (
                                groups.map((group) => (
                                    <section key={group.id}>
                                        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            {group.id === "commerce" && showCatalogTile && (
                                                <button
                                                    type="button"
                                                    onClick={() => void addCatalog()}
                                                    disabled={locked || hasCatalog || !canManage}
                                                    className="flex items-center gap-2.5 rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/40 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                                                >
                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/70">
                                                        {working === "catalog" ? <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin text-muted-foreground" /> : <ShoppingBag className="h-4 w-4" />}
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-sm">Your products</span>
                                                        <span className="block truncate text-[11px] text-muted-foreground">{hasCatalog ? "Added" : "List or import them"}</span>
                                                    </span>
                                                </button>
                                            )}
                                            {visibleMcpApps.filter((app) => app.category === group.id).map((app) => {
                                                const added = !!serverFor(app);
                                                return (
                                                    <button
                                                        key={`mcp:${app.id}`}
                                                        type="button"
                                                        onClick={() => void signInApp(app)}
                                                        disabled={locked || !app.available || added}
                                                        className="flex items-center gap-2.5 rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/40 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                                                    >
                                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/70">
                                                            {working === app.id
                                                                ? <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin text-muted-foreground" />
                                                                // eslint-disable-next-line @next/next/no-img-element -- the app's favicon
                                                                : <img src={faviconFor(app.domain)} alt="" className="h-5 w-5 object-contain" />}
                                                        </span>
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-sm">{app.name}</span>
                                                            <span className="block truncate text-[11px] text-muted-foreground">{working === app.id ? "Waiting for sign-in…" : !app.available ? "Coming soon" : added ? "Added" : "Sign in"}</span>
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                            {group.apps.map((app) => {
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
                                    </section>
                                ))
                            )}
                            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
                        </>
                    )}
                </div>
            </DockedPanel>
        </div>
    );
}

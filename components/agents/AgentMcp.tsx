"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import McpServerIcon from "@hugeicons/core-free-icons/McpServerIcon";
import { ChevronDown, KeyRound, LogIn, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { DockedPanel } from "@/components/agents/DockedPanel";
import { applyStudioResult } from "@/components/agents/studio";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

type McpTool = { name: string; description: string; readOnly: boolean; destructive: boolean };
type McpServer = { id: string; name: string; url: string; headers: Array<{ name: string }>; tools: McpTool[]; enabled: string[]; signed_in?: { issuer: string }; icon?: string };
type ConnectResponse = { ok?: boolean; needs_auth?: boolean; sign_in?: { issuer: string; authorize_url?: string }; error?: string; server?: McpServer };
type SignInMessage = { type: "cencori:mcp-oauth"; ok: boolean; name?: string; on?: number; total?: number; error?: string };

const inputClass = "w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring disabled:cursor-not-allowed disabled:opacity-60";

/**
 * A small window opened during the click (so browsers don't block it) that
 * shows "Connecting…" until it's sent to the server's sign-in page or closed.
 */
function openSignInWindow(serverUrl: string): Window | null {
    const width = 520;
    const height = 720;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const popup = window.open("", "cencori-mcp-sign-in", `width=${width},height=${height},left=${left},top=${top}`);
    if (!popup) return null;
    try {
        popup.document.title = "Connecting…";
        popup.document.body.style.cssText = "margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font:14px -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#666";
        popup.document.body.textContent = `Connecting to ${hostOf(serverUrl)}…`;
    } catch {
        // A window left over from an earlier sign-in may be on another site; it's reused as is.
    }
    return popup;
}

/** The server's logo, found when it was connected, or the generic server icon. */
export function ServerIcon({ icon, className }: { icon?: string; className?: string }) {
    return (
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/70", className)}>
            {icon
                // eslint-disable-next-line @next/next/no-img-element -- a stored data URL; nothing for next/image to optimise
                ? <img src={icon} alt="" className="h-5 w-5 object-contain" />
                : <HugeiconsIcon icon={McpServerIcon} className="h-4 w-4" />}
        </span>
    );
}

/** Public servers that need no key, to try it in one click. */
const EXAMPLES = [{ label: "DeepWiki", url: "https://mcp.deepwiki.com/mcp" }];

function hostOf(url: string) {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

/**
 * The agent's MCP servers: paste a URL in the Add server panel, then pick
 * which of its tools the agent may use. The page header owns the Add server
 * button once servers exist, so the panel's open state comes from it.
 */
export function AgentMcp({ adding, onAddingChange }: { adding: boolean; onAddingChange: (adding: boolean) => void }) {
    const { projectId, agent, version, editable, canManage, busy } = useAgentWorkspace();
    const queryClient = useQueryClient();
    const servers = ((version?.config_json.mcp_servers ?? []) as McpServer[]).filter((server) => server && typeof server.id === "string");
    const [url, setUrl] = useState("");
    // Shown when the server answered 401/403: the key to send, and for which server.
    const [auth, setAuth] = useState<{ serverId: string | null; header: string; value: string } | null>(null);
    const [connecting, setConnecting] = useState<string | null>(null);
    // The server offers sign-in (OAuth) instead of a key: for a new server (null) or a stored one.
    // `waiting`: the sign-in window is open and the owner is approving there.
    const [signIn, setSignIn] = useState<{ serverId: string | null; issuer: string; waiting?: boolean } | null>(null);
    const popupRef = useRef<Window | null>(null);
    const [saving, setSaving] = useState(false);
    // Servers whose tool list is open; collapsed by default, a big server has dozens.
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const toggleExpanded = (id: string) => setExpanded((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const [error, setError] = useState<string | null>(null);
    const canEdit = canManage && editable;
    const locked = !canEdit || !!busy || saving || !!connecting;

    // Show the saved draft from the response; the full reload runs in the background.
    const refetch = (result?: Record<string, unknown> | null) => applyStudioResult(queryClient, projectId, result);

    /** Connect a new server (serverId null) or refresh / re-key a stored one. */
    /**
     * Connect a new server (serverId null) or refresh / re-key a stored one.
     * `popup` is a window opened on the click: if the server uses sign-in it
     * goes straight to the sign-in page, otherwise it's closed.
     */
    const connect = async (opts: { url?: string; serverId?: string | null; key?: { header: string; value: string }; popup?: Window | null }) => {
        if (!version) return;
        const target = opts.serverId ?? "new";
        setConnecting(target);
        setError(null);
        let keepConnecting = false;
        try {
            const response = await fetch(`/api/projects/${projectId}/embedded-agents/studio`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "mcp_connect",
                    agent_id: agent.id,
                    version_id: version.id,
                    ...(opts.url ? { url: opts.url } : {}),
                    ...(opts.serverId ? { server_id: opts.serverId } : {}),
                    ...(opts.key ? { headers: [{ name: opts.key.header.trim() || "Authorization", value: opts.key.value }] } : {}),
                }),
            });
            const body = await response.json().catch(() => ({})) as ConnectResponse;
            if (body.needs_auth && body.sign_in && !opts.key) {
                setAuth(null);
                setError(null);
                if (opts.popup && !opts.popup.closed && body.sign_in.authorize_url) {
                    // Straight to sign-in, in the window already open.
                    opts.popup.location.href = body.sign_in.authorize_url;
                    popupRef.current = opts.popup;
                    setSignIn({ serverId: opts.serverId ?? null, issuer: body.sign_in.issuer, waiting: true });
                    keepConnecting = true;
                } else {
                    setSignIn({ serverId: opts.serverId ?? null, issuer: body.sign_in.issuer });
                }
                return;
            }
            opts.popup?.close();
            if (body.needs_auth) {
                setAuth((current) => ({ serverId: opts.serverId ?? null, header: current?.header ?? "Authorization", value: "" }));
                setError(body.error ?? "This server needs a key to connect.");
                return;
            }
            if (!response.ok || !body.server) throw new Error(body.error ?? "Couldn't connect to that server.");
            refetch(body as Record<string, unknown>);
            setAuth(null);
            if (!opts.serverId) {
                setUrl("");
                onAddingChange(false);
            }
            const on = body.server.enabled.length;
            toast.success(opts.serverId ? `${body.server.name} refreshed` : `${body.server.name} connected`, {
                description: `${on} of ${body.server.tools.length} tools on.`,
            });
        } catch (cause) {
            opts.popup?.close();
            setError(cause instanceof Error ? cause.message : "Couldn't connect to that server.");
        } finally {
            if (!keepConnecting) setConnecting(null);
        }
    };

    const saveServers = async (next: McpServer[], message: string) => {
        if (!version) return;
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`/api/projects/${projectId}/embedded-agents/studio`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "save_tools", agent_id: agent.id, version_id: version.id, mcp_servers: next.map(({ id, name, enabled }) => ({ id, name, enabled })) }),
            });
            const body = await response.json().catch(() => ({})) as { error?: string };
            if (!response.ok) throw new Error(body.error ?? "Couldn't save. Try again.");
            refetch(body as Record<string, unknown>);
            if (message) toast.success(message);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't save. Try again.");
        } finally {
            setSaving(false);
        }
    };

    const toggleTool = (server: McpServer, tool: string, on: boolean) => {
        const enabled = on ? [...server.enabled, tool] : server.enabled.filter((name) => name !== tool);
        void saveServers(servers.map((s) => (s.id === server.id ? { ...s, enabled } : s)), "");
    };

    const openAdd = () => onAddingChange(true);
    const closeAdd = () => {
        if (!auth?.serverId) setAuth(null);
        if (!signIn?.serverId) setSignIn(null);
        setError(null);
        onAddingChange(false);
    };

    const submitUrl = () => {
        const value = url.trim();
        if (!value) return;
        const key = auth && !auth.serverId && auth.value ? auth : undefined;
        // Opened during the click so it isn't blocked; used for sign-in if the server asks for it.
        void connect({ url: value, key, popup: key ? null : openSignInWindow(value) });
    };

    const newServerAuth = auth && !auth.serverId;
    const newServerSignIn = signIn && !signIn.serverId;

    /**
     * Sign in through the server's OAuth in a popup. The window opens on the
     * click itself (so it isn't blocked) and is pointed at the sign-in page
     * once Cencori has registered with the server.
     */
    const startSignIn = async (serverId: string | null) => {
        if (!version) return;
        const popup = openSignInWindow(serverId ? servers.find((s) => s.id === serverId)?.url ?? "" : url.trim());
        popupRef.current = popup;
        setConnecting(serverId ?? "new");
        setError(null);
        try {
            const response = await fetch(`/api/projects/${projectId}/embedded-agents/studio`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "mcp_oauth_start", agent_id: agent.id, version_id: version.id, ...(serverId ? { server_id: serverId } : { url: url.trim() }) }),
            });
            const body = await response.json().catch(() => ({})) as { authorize_url?: string; error?: string };
            if (!response.ok || !body.authorize_url) throw new Error(body.error ?? "Couldn't start the sign-in.");
            if (!popup || popup.closed) {
                // Popups blocked: sign in in this tab instead; the callback page explains what to do next.
                window.location.assign(body.authorize_url);
                return;
            }
            popup.location.href = body.authorize_url;
            setSignIn((current) => (current ? { ...current, waiting: true } : current));
        } catch (cause) {
            popup?.close();
            setConnecting(null);
            setError(cause instanceof Error ? cause.message : "Couldn't start the sign-in.");
        }
    };

    // Opening the panel (from here or the page header) starts it fresh.
    useEffect(() => {
        if (!adding) return;
        setUrl("");
        setAuth((current) => (current?.serverId ? current : null));
        setSignIn((current) => (current?.serverId ? current : null));
        setError(null);
    }, [adding]);

    // The sign-in popup reports back here, then closes itself.
    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || (event.data as SignInMessage | null)?.type !== "cencori:mcp-oauth") return;
            const result = event.data as SignInMessage;
            setConnecting(null);
            if (!result.ok) {
                setError(result.error ?? "Sign-in didn't complete.");
                return;
            }
            setSignIn(null);
            setUrl("");
            onAddingChange(false);
            void refetch();
            toast.success(`${result.name} connected`, { description: `${result.on} of ${result.total} tools on.` });
        };
        window.addEventListener("message", onMessage);
        // Stop the spinner if the popup is closed without finishing.
        const poll = window.setInterval(() => {
            if (popupRef.current?.closed) {
                popupRef.current = null;
                setConnecting(null);
                setSignIn((current) => (current?.waiting ? { ...current, waiting: false } : current));
            }
        }, 800);
        return () => {
            window.removeEventListener("message", onMessage);
            window.clearInterval(poll);
        };
    }, [onAddingChange]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="space-y-6">
            {servers.length === 0 ? (
                <div className="flex flex-col items-center rounded-lg border border-border/60 px-6 py-14 text-center">
                    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/70 text-foreground"><HugeiconsIcon icon={McpServerIcon} className="h-5 w-5" /></span>
                    <p className="text-sm font-medium">No MCP servers yet</p>
                    <p className="mt-1 max-w-[40ch] text-xs leading-5 text-muted-foreground">Connect a server and {agent.name} can use its tools: paste its URL and pick the tools.</p>
                    {canEdit && (
                        <Button size="sm" className="mt-4 h-7 gap-1.5 text-xs" onClick={() => openAdd()} disabled={locked}>
                            <Plus className="h-3.5 w-3.5" />
                            Add server
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
                        {servers.map((server) => {
                            const serverAuth = auth?.serverId === server.id ? auth : null;
                            const isOpen = expanded.has(server.id);
                            return (
                                <section key={server.id}>
                                    <header className={cn("flex items-center gap-3 px-4 py-3", isOpen && "border-b border-border/60")}>
                                        <button
                                            type="button"
                                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                            onClick={() => toggleExpanded(server.id)}
                                            aria-expanded={isOpen}
                                            aria-label={`${isOpen ? "Hide" : "Show"} ${server.name} tools`}
                                        >
                                            <ServerIcon icon={server.icon} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">{server.name}</span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    <span className="font-mono">{hostOf(server.url)}</span> · {server.enabled.length} of {server.tools.length} tools on{server.signed_in ? " · signed in" : server.headers.length > 0 ? " · key saved" : ""}
                                                </span>
                                            </span>
                                            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                                        </button>
                                        {canEdit && (
                                            <div className="flex shrink-0 items-center gap-1">
                                                {server.signed_in ? (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => void startSignIn(server.id)} disabled={locked} aria-label={`Sign in to ${server.name} again`} title="Sign in again">
                                                        {connecting === server.id ? <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                                                    </Button>
                                                ) : (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setError(null); setAuth(serverAuth ? null : { serverId: server.id, header: server.headers[0]?.name ?? "Authorization", value: "" }); }} disabled={locked} aria-label={`Update ${server.name} key`} title={server.headers.length ? "Update key" : "Add key"}>
                                                        <KeyRound className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => void connect({ serverId: server.id })} disabled={locked} aria-label={`Refresh ${server.name} tools`} title="Refresh tools">
                                                    {connecting === server.id ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void saveServers(servers.filter((s) => s.id !== server.id), `${server.name} removed`)} disabled={locked} aria-label={`Remove ${server.name}`} title="Remove">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </header>
                                    {signIn?.serverId === server.id && (
                                        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                                            <p className="text-xs text-muted-foreground">The sign-in for {server.name} has expired.</p>
                                            <Button size="sm" className="h-7 shrink-0 gap-1.5 text-xs" onClick={() => void startSignIn(server.id)} disabled={locked}>
                                                {connecting === server.id && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                                                Sign in again
                                            </Button>
                                        </div>
                                    )}
                                    {serverAuth && (
                                        <div className="border-b border-border/60 px-4 py-3">
                                            <KeyForm
                                                auth={serverAuth}
                                                onChange={setAuth}
                                                disabled={locked}
                                                connecting={connecting === server.id}
                                                onSubmit={() => void connect({ serverId: server.id, key: serverAuth })}
                                            />
                                            {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
                                        </div>
                                    )}
                                    {isOpen && <ul className="divide-y divide-border/60">
                                        {server.tools.map((tool) => (
                                            <li key={tool.name} className="flex items-start justify-between gap-4 px-4 py-2.5">
                                                <div className="min-w-0">
                                                    <p className="flex items-center gap-2">
                                                        <span className="truncate font-mono text-[13px]">{tool.name}</span>
                                                        {/* Only what servers mark explicitly; most don't mark read-only tools. */}
                                                        {tool.destructive && (
                                                            <span className="shrink-0 rounded-[4px] border border-destructive/30 px-1.5 text-[10px] text-destructive">Can delete</span>
                                                        )}
                                                    </p>
                                                    {tool.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{tool.description}</p>}
                                                </div>
                                                <Switch
                                                    checked={server.enabled.includes(tool.name)}
                                                    disabled={locked}
                                                    aria-label={tool.name}
                                                    onCheckedChange={(checked) => toggleTool(server, tool.name, checked)}
                                                />
                                            </li>
                                        ))}
                                    </ul>}
                                </section>
                            );
                        })}
                    </div>
                    {/* Toggle, refresh and remove errors; connect errors show in the panel or the key form. */}
                    {error && !adding && !auth && <p role="alert" className="text-xs text-destructive">{error}</p>}
                </div>
            )}

            <DockedPanel open={adding} onOpenChange={(next) => { if (!next && connecting !== "new") closeAdd(); }}>
                <SheetHeader className="border-b border-border/60 px-5 py-4">
                    <SheetTitle className="text-base font-medium">Add MCP server</SheetTitle>
                    <SheetDescription className="text-xs">Paste the server&apos;s URL.</SheetDescription>
                </SheetHeader>
                <form className="flex-1 space-y-5 overflow-y-auto px-5 py-5" onSubmit={(event) => { event.preventDefault(); if (newServerSignIn && !newServerAuth) void startSignIn(null); else submitUrl(); }}>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-medium">Server URL</span>
                        <input
                            value={url}
                            onChange={(event) => { setUrl(event.target.value); if (newServerAuth) setAuth(null); if (newServerSignIn) setSignIn(null); setError(null); }}
                            disabled={locked}
                            placeholder="https://mcp.example.com/mcp"
                            aria-label="MCP server URL"
                            className={cn(inputClass, "font-mono text-[13px]")}
                        />
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                            Any MCP server over HTTP.{" "}
                            {EXAMPLES.map((example) => (
                                <button key={example.url} type="button" className="text-foreground underline-offset-2 hover:underline" onClick={() => { setUrl(example.url); setAuth(null); setSignIn(null); setError(null); }} disabled={locked}>
                                    Try {example.label}
                                </button>
                            ))}
                        </span>
                    </label>
                    {newServerSignIn && !newServerAuth && (
                        <div className="rounded-md border border-border/60 p-4">
                            {signIn.waiting ? (
                                <>
                                    <p className="flex items-center gap-2 text-sm">
                                        <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                        Finish signing in to {signIn.issuer}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">Approve Cencori in the window that opened. This panel updates when you&apos;re done.</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm">{signIn.issuer} uses sign-in</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">The sign-in window was closed or blocked. Sign in to let the agent use this server; no key needed.</p>
                                </>
                            )}
                            <div className="mt-2 flex items-center gap-4">
                                {signIn.waiting && (
                                    <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => void startSignIn(null)} disabled={!canEdit}>
                                        Reopen window
                                    </button>
                                )}
                                <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => { popupRef.current?.close(); setConnecting(null); setSignIn((current) => (current ? { ...current, waiting: false } : current)); setAuth({ serverId: null, header: "Authorization", value: "" }); }} disabled={!canEdit}>
                                    Use a key instead
                                </button>
                            </div>
                        </div>
                    )}
                    {newServerAuth && (
                        <div>
                            <span className="mb-1.5 block text-xs font-medium">Key</span>
                            <p className="mb-2 text-[11px] text-muted-foreground">This server needs an API key or token. It&apos;s encrypted and never shown again.</p>
                            <div className="flex gap-2">
                                <input
                                    value={auth.header}
                                    onChange={(event) => setAuth({ ...auth, header: event.target.value })}
                                    disabled={locked}
                                    aria-label="Header name"
                                    className={cn(inputClass, "w-[40%] py-1.5 font-mono text-xs")}
                                />
                                <input
                                    type="password"
                                    value={auth.value}
                                    onChange={(event) => setAuth({ ...auth, value: event.target.value })}
                                    disabled={locked}
                                    placeholder={auth.header.toLowerCase() === "authorization" ? "Bearer sk_…" : "Key"}
                                    aria-label="Key"
                                    autoComplete="off"
                                    autoFocus
                                    className={cn(inputClass, "py-1.5 font-mono text-xs")}
                                />
                            </div>
                        </div>
                    )}
                    {error && !auth?.serverId && <p role="alert" className="text-xs text-destructive">{error}</p>}
                    {/* Enter submits from either field. */}
                    <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
                </form>
                <SheetFooter className="flex-row justify-end gap-2 border-t border-border/60 px-5 py-3">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={closeAdd} disabled={connecting === "new"}>Cancel</Button>
                    {newServerSignIn && !newServerAuth ? (
                        <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => void startSignIn(null)} disabled={locked}>
                            {connecting === "new" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                            {connecting === "new" ? "Waiting for sign-in…" : "Sign in"}
                        </Button>
                    ) : (
                        <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={submitUrl} disabled={locked || !url.trim() || (!!newServerAuth && !auth.value.trim())}>
                            {connecting === "new" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                            {connecting === "new" ? "Connecting…" : "Connect"}
                        </Button>
                    )}
                </SheetFooter>
            </DockedPanel>
        </div>
    );
}

/** The key a server asked for: a header name (usually Authorization) and its value. */
function KeyForm({ auth, onChange, disabled, connecting, onSubmit }: {
    auth: { serverId: string | null; header: string; value: string };
    onChange: (auth: { serverId: string | null; header: string; value: string }) => void;
    disabled: boolean;
    connecting: boolean;
    onSubmit: () => void;
}) {
    return (
        <form className="mt-3 space-y-2" onSubmit={(event) => { event.preventDefault(); if (auth.value.trim()) onSubmit(); }}>
            <p className="text-xs text-muted-foreground">Paste the server&apos;s API key or token. It&apos;s encrypted and never shown again.</p>
            <div className="flex gap-2">
                <input
                    value={auth.header}
                    onChange={(event) => onChange({ ...auth, header: event.target.value })}
                    disabled={disabled}
                    aria-label="Header name"
                    className={cn(inputClass, "w-[34%] py-1.5 font-mono text-xs")}
                />
                <input
                    type="password"
                    value={auth.value}
                    onChange={(event) => onChange({ ...auth, value: event.target.value })}
                    disabled={disabled}
                    placeholder={auth.header.toLowerCase() === "authorization" ? "Bearer sk_…" : "Key"}
                    aria-label="Key"
                    autoComplete="off"
                    autoFocus
                    className={cn(inputClass, "py-1.5 font-mono text-xs")}
                />
                <Button type="submit" size="sm" className="h-[30px] shrink-0 gap-1.5 text-xs" disabled={disabled || !auth.value.trim()}>
                    {connecting && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                    Connect
                </Button>
            </div>
        </form>
    );
}

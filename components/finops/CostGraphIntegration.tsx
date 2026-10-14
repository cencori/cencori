"use client";

/**
 * CostGraph integration card: send this organization's AI spend to CostGraph as FOCUS 1.2.
 *
 * Lives on a project's Settings → Integrations, but the connection belongs to the organization —
 * CostGraph keys usage on the billing account, which is the organization id — so it applies to
 * every project and only owners and admins can change it.
 *
 * Two ways to connect:
 *   - Connect CostGraph: "Sign in with CostGraph" (OAuth). Shown when COSTGRAPH_OAUTH_ENABLED.
 *   - Paste a key: a focus:write key and the fpc_ push connection id from CostGraph's dashboard.
 */

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, FileSpreadsheet, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
    cancelCostGraphConnect,
    completeCostGraphConnect,
    deleteCostGraphConnection,
    getUsageExportSettings,
    pushCostGraphNow,
    saveCostGraphConnection,
    type CostGraphConnectionView,
    type UsageExportSettings,
} from "@/app/(app)/[orgSlug]/~/settings/actions";

export const SUB_ACCOUNT_OPTIONS = [
    { value: "project", label: "Project", hint: "Each Cencori project is a sub-account." },
    { value: "end_user", label: "End user", hint: "The end user id you send with requests — your customers." },
    { value: "tenant", label: "Tenant", hint: "Embedded-agent tenants." },
    { value: "none", label: "None", hint: "Leave the sub-account column empty." },
] as const;

export function usageExportQueryKey(orgSlug: string) {
    return ["usageExportSettings", orgSlug];
}

const CALLBACK_MESSAGES: Record<string, string> = {
    denied: "CostGraph sign-in was cancelled.",
    forbidden: "Only organization owners and admins can connect CostGraph.",
    signed_out: "Sign in to Cencori again, then connect CostGraph.",
    expired: "That CostGraph sign-in took too long. Connect again.",
    no_tenant: "Your CostGraph account has no tenant to send usage to.",
    unsupported: "CostGraph doesn't support connecting this way yet. Use an API key instead.",
    unavailable: "Connecting with CostGraph sign-in isn't available yet. Use an API key instead.",
    invalid_scope: "CostGraph didn't allow the permissions Cencori asked for.",
};

/* ---------- Shared card pieces ---------- */

export function CardShell({
    icon: Icon,
    title,
    description,
    action,
    children,
    footer,
}: {
    icon: typeof FileSpreadsheet;
    title: string;
    description: string;
    action?: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-lg border border-border/35 bg-muted/30">
            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border/35 bg-background/30">
                        <Icon className="size-4 text-foreground" />
                    </div>
                    <div>
                        <h2 className="text-sm font-medium">{title}</h2>
                        <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">{description}</p>
                    </div>
                </div>
                {action}
            </div>
            {children}
            {footer && (
                <div className="border-t border-border/30 bg-background/20 px-5 py-3">
                    <p className="max-w-2xl text-[11px] leading-5 text-muted-foreground">{footer}</p>
                </div>
            )}
        </div>
    );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex min-h-12 items-center justify-between gap-6 px-5 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`truncate text-right text-[13px] font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
        </div>
    );
}

/** CostGraph binds a push connection to the BillingAccountId our records carry: the org id. */
function CopyRow({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="flex min-h-12 items-center justify-between gap-6 px-5 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <button
                type="button"
                className="flex min-w-0 items-center gap-1.5 text-right font-mono text-[13px] font-medium hover:text-foreground"
                onClick={async () => {
                    await navigator.clipboard.writeText(value);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                }}
                aria-label={`Copy ${label}`}
            >
                <span className="truncate">{value}</span>
                {copied ? <Check className="size-3 shrink-0" /> : <Copy className="size-3 shrink-0 text-muted-foreground" />}
            </button>
        </div>
    );
}

/* ---------- The card ---------- */

export function CostGraphIntegration({ orgSlug }: { orgSlug: string }) {
    const queryKey = usageExportQueryKey(orgSlug);
    const { data, isLoading, error } = useQuery<UsageExportSettings>({
        queryKey,
        queryFn: async () => {
            const result = await getUsageExportSettings(orgSlug);
            if (!result.ok || !result.data) throw new Error(result.error || "Could not load the CostGraph integration");
            return result.data;
        },
        staleTime: 30 * 1000,
    });

    useCallbackNotice(queryKey);

    if (isLoading) return <Skeleton className="h-60 w-full rounded-lg" />;
    if (error || !data) {
        return (
            <CardShell
                icon={FileSpreadsheet}
                title="CostGraph"
                description="Send this organization's AI spend to CostGraph, by model, project and customer."
            >
                <p className="border-t border-border/30 px-5 py-4 text-xs text-muted-foreground">
                    {error instanceof Error ? error.message : "Could not load the CostGraph integration."}
                </p>
            </CardShell>
        );
    }

    return <CostGraphCard orgSlug={orgSlug} settings={data} queryKey={queryKey} />;
}

/** Turn the OAuth callback's `?costgraph=` result into a toast, then drop it from the URL. */
function useCallbackNotice(queryKey: string[]) {
    const params = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const queryClient = useQueryClient();
    const result = params.get("costgraph");
    const reason = params.get("reason");

    useEffect(() => {
        if (!result) return;
        if (result === "connected") toast.success("CostGraph connected. Usage is sent nightly.");
        else if (result === "choose_tenant") toast.success("Signed in to CostGraph. Choose the tenant to send usage to.");
        else if (result === "error") toast.error(CALLBACK_MESSAGES[reason ?? ""] ?? "Could not connect CostGraph.");
        void queryClient.invalidateQueries({ queryKey });

        const next = new URLSearchParams(params.toString());
        next.delete("costgraph");
        next.delete("reason");
        router.replace(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
        // Runs once per callback result.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [result]);
}

function CostGraphCard({
    orgSlug,
    settings,
    queryKey,
}: {
    orgSlug: string;
    settings: UsageExportSettings;
    queryKey: string[];
}) {
    const connection = settings.costgraph;
    const queryClient = useQueryClient();
    const refresh = () => queryClient.invalidateQueries({ queryKey });
    const [keyDialogOpen, setKeyDialogOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const startOAuth = () => {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/api/integrations/costgraph/oauth/start?org=${encodeURIComponent(orgSlug)}&returnTo=${encodeURIComponent(returnTo)}`;
    };

    const pushNow = useMutation({
        mutationFn: async () => {
            const result = await pushCostGraphNow(orgSlug);
            if (!result.ok) throw new Error(result.error || "The push failed");
            return result.data;
        },
        onSuccess: (view) => {
            toast.success(view && view.sentRows > 0 ? `Sent ${view.sentRows} FOCUS rows to CostGraph.` : "CostGraph is up to date.");
            void refresh();
        },
        onError: (err: Error) => {
            toast.error(err.message);
            void refresh();
        },
    });

    const status = !connection
        ? "Not connected"
        : !connection.enabled
            ? "Paused"
            : !connection.connectionId
                ? "Waiting for CostGraph"
                : connection.lastRunStatus === "error"
                    ? "Last push failed"
                    : connection.lastRunAt
                        ? "Active"
                        : "Waiting for first push";

    const connectAction = settings.oauthAvailable ? (
        <div className="flex flex-col items-start gap-1.5 self-start sm:items-end">
            <Button size="sm" className="h-7 px-3 text-xs" onClick={startOAuth}>Connect CostGraph</Button>
            <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setKeyDialogOpen(true)}>
                Use an API key instead
            </button>
        </div>
    ) : (
        <Button size="sm" className="h-7 self-start px-3 text-xs" onClick={() => setKeyDialogOpen(true)}>Connect</Button>
    );

    return (
        <CardShell
            icon={FileSpreadsheet}
            title="CostGraph"
            description="Send this organization's AI spend to CostGraph as FOCUS 1.2, by model, project and customer, so it sits beside the rest of your cloud bill. Sent nightly; closed months are re-sent so late usage corrects itself."
            action={connection ? (
                <div className="flex gap-2 self-start">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-xs"
                        disabled={pushNow.isPending || !connection.enabled || !connection.connectionId}
                        onClick={() => pushNow.mutate()}
                    >
                        <Send className="mr-1.5 size-3" />
                        {pushNow.isPending ? "Sending…" : "Send now"}
                    </Button>
                    <Button size="sm" className="h-7 px-3 text-xs" onClick={() => setSettingsOpen(true)}>Manage</Button>
                </div>
            ) : settings.pendingTenants ? null : connectAction}
            footer="Applies to every project in this organization. Usage is reported at what Cencori billed; BYOK usage reports zero, because your own provider account bills it."
        >
            {settings.pendingTenants && !connection ? (
                <TenantPicker orgSlug={orgSlug} tenants={settings.pendingTenants} onDone={refresh} />
            ) : (
                <div className="divide-y divide-border/30 border-t border-border/30">
                    <Row label="Status" value={status} />
                    {connection && (
                        <>
                            <Row
                                label="Connected with"
                                value={connection.authMethod === "oauth"
                                    ? `CostGraph sign-in${connection.tenantName ? ` · ${connection.tenantName}` : ""}`
                                    : `API key ${connection.apiKeyHint ?? ""}`}
                            />
                            <Row label="Connection" value={connection.connectionId ?? "Not created yet"} mono />
                            <Row label="Sub-account" value={SUB_ACCOUNT_OPTIONS.find((o) => o.value === connection.subAccount)?.label ?? connection.subAccount} />
                            <Row label="Sent through" value={connection.lastPushedDay ?? "Nothing sent yet"} mono />
                            {connection.lastRunStatus === "error" && connection.lastRunError && (
                                <div className="px-5 py-3">
                                    <p className="break-words font-mono text-[11px] leading-5 text-destructive">{connection.lastRunError}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            <ApiKeyDialog
                open={keyDialogOpen}
                onOpenChange={setKeyDialogOpen}
                orgSlug={orgSlug}
                organizationId={settings.organizationId}
                connection={connection}
                onSaved={refresh}
            />
            {connection && (
                <ManageDialog
                    open={settingsOpen}
                    onOpenChange={setSettingsOpen}
                    orgSlug={orgSlug}
                    connection={connection}
                    oauthAvailable={settings.oauthAvailable}
                    onSwitchToKey={() => { setSettingsOpen(false); setKeyDialogOpen(true); }}
                    onReconnect={startOAuth}
                    onSaved={refresh}
                />
            )}
        </CardShell>
    );
}

function TenantPicker({
    orgSlug,
    tenants,
    onDone,
}: {
    orgSlug: string;
    tenants: Array<{ id: string; name: string }>;
    onDone: () => void;
}) {
    const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
    const complete = useMutation({
        mutationFn: async () => {
            const result = await completeCostGraphConnect(orgSlug, tenantId);
            if (!result.ok) throw new Error(result.error || "Could not connect CostGraph");
        },
        onSuccess: () => {
            toast.success("CostGraph connected. Usage is sent nightly.");
            onDone();
        },
        onError: (err: Error) => {
            toast.error(err.message);
            onDone();
        },
    });
    const cancel = useMutation({
        mutationFn: async () => { await cancelCostGraphConnect(orgSlug); },
        onSuccess: onDone,
    });

    return (
        <div className="space-y-3 border-t border-border/30 px-5 py-4">
            <Label className="text-xs">Send usage to which CostGraph tenant?</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id} className="text-xs">{tenant.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" className="h-7 px-3 text-xs" disabled={cancel.isPending} onClick={() => cancel.mutate()}>Cancel</Button>
                <Button size="sm" className="h-7 px-3 text-xs" disabled={!tenantId || complete.isPending} onClick={() => complete.mutate()}>
                    {complete.isPending ? "Connecting…" : "Connect"}
                </Button>
            </div>
        </div>
    );
}

/** The paste-a-key flow: works today, with no OAuth on CostGraph's side. */
function ApiKeyDialog({
    open,
    onOpenChange,
    orgSlug,
    organizationId,
    connection,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgSlug: string;
    organizationId: string;
    connection: CostGraphConnectionView | null;
    onSaved: () => void;
}) {
    const keyConnection = connection?.authMethod === "api_key" ? connection : null;
    const [connectionId, setConnectionId] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [subAccount, setSubAccount] = useState<string>("project");

    useEffect(() => {
        if (!open) return;
        setConnectionId(keyConnection?.connectionId ?? "");
        setApiKey("");
        setSubAccount(connection?.subAccount ?? "project");
    }, [open, keyConnection?.connectionId, connection?.subAccount]);

    const subAccountLocked = Boolean(connection?.lastPushedDay) && connectionId === connection?.connectionId;

    const save = useMutation({
        mutationFn: async () => {
            const result = await saveCostGraphConnection(orgSlug, {
                connectionId,
                apiKey,
                subAccount,
                enabled: connection?.enabled ?? true,
            });
            if (!result.ok) throw new Error(result.error || "Could not save");
        },
        onSuccess: () => {
            toast.success(connection ? "CostGraph connection updated." : "CostGraph connected. The first push sends this month so far.");
            onOpenChange(false);
            onSaved();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-sm">Connect CostGraph with an API key</DialogTitle>
                    <DialogDescription className="text-xs leading-5">
                        In CostGraph, open Integrations → Anything Else → FOCUS push. Leave Provider on “Detect from my first push”, use the billing account id below, and copy the connection id. Then create a focus:write key under Settings → API keys in the same tenant.
                    </DialogDescription>
                </DialogHeader>
                <div className="overflow-hidden rounded-md border border-border/35">
                    <CopyRow label="Billing account id" value={organizationId} />
                </div>
                <form
                    className="space-y-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        save.mutate();
                    }}
                >
                    <div className="space-y-2">
                        <Label htmlFor="cg-connection" className="text-xs">Push connection id</Label>
                        <Input
                            id="cg-connection"
                            value={connectionId}
                            onChange={(event) => setConnectionId(event.target.value)}
                            placeholder="fpc_…"
                            autoComplete="off"
                            className="h-8 font-mono text-xs"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cg-key" className="text-xs">
                            API key {keyConnection && <span className="text-muted-foreground">(leave empty to keep {keyConnection.apiKeyHint})</span>}
                        </Label>
                        <Input
                            id="cg-key"
                            type="password"
                            value={apiKey}
                            onChange={(event) => setApiKey(event.target.value)}
                            placeholder="focus:write key"
                            autoComplete="off"
                            className="h-8 font-mono text-xs"
                        />
                    </div>
                    <SubAccountField value={subAccount} onChange={setSubAccount} locked={subAccountLocked} />
                    <DialogFooter>
                        <Button type="submit" size="sm" className="h-7 px-3 text-xs" disabled={save.isPending}>
                            {save.isPending ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ManageDialog({
    open,
    onOpenChange,
    orgSlug,
    connection,
    oauthAvailable,
    onSwitchToKey,
    onReconnect,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgSlug: string;
    connection: CostGraphConnectionView;
    oauthAvailable: boolean;
    onSwitchToKey: () => void;
    onReconnect: () => void;
    onSaved: () => void;
}) {
    const [enabled, setEnabled] = useState(connection.enabled);
    useEffect(() => { if (open) setEnabled(connection.enabled); }, [open, connection.enabled]);

    const save = useMutation({
        mutationFn: async () => {
            if (connection.authMethod !== "api_key" || !connection.connectionId) return;
            const result = await saveCostGraphConnection(orgSlug, {
                connectionId: connection.connectionId,
                subAccount: connection.subAccount,
                enabled,
            });
            if (!result.ok) throw new Error(result.error || "Could not save");
        },
        onSuccess: () => {
            onOpenChange(false);
            onSaved();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const disconnect = useMutation({
        mutationFn: async () => {
            const result = await deleteCostGraphConnection(orgSlug);
            if (!result.ok) throw new Error(result.error || "Could not disconnect");
        },
        onSuccess: () => {
            toast.success("CostGraph disconnected.");
            onOpenChange(false);
            onSaved();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-sm">CostGraph connection</DialogTitle>
                    <DialogDescription className="text-xs leading-5">
                        {connection.authMethod === "oauth"
                            ? `Connected with CostGraph sign-in${connection.tenantName ? ` to ${connection.tenantName}` : ""}.`
                            : `Connected with API key ${connection.apiKeyHint ?? ""}.`}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-5">
                    <SubAccountField value={connection.subAccount} onChange={() => undefined} locked />
                    {connection.authMethod === "api_key" && (
                        <div className="flex items-center justify-between">
                            <Label htmlFor="cg-enabled" className="text-xs">Send nightly</Label>
                            <Switch id="cg-enabled" checked={enabled} onCheckedChange={setEnabled} />
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {oauthAvailable && (
                            <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={onReconnect}>
                                {connection.authMethod === "oauth" ? "Reconnect" : "Switch to CostGraph sign-in"}
                            </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={onSwitchToKey}>
                            {connection.authMethod === "api_key" ? "Change key or connection" : "Use an API key instead"}
                        </Button>
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:justify-between">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-xs text-destructive hover:text-destructive"
                        disabled={disconnect.isPending}
                        onClick={() => disconnect.mutate()}
                    >
                        Disconnect
                    </Button>
                    {connection.authMethod === "api_key" && (
                        <Button size="sm" className="h-7 px-3 text-xs" disabled={save.isPending} onClick={() => save.mutate()}>
                            {save.isPending ? "Saving…" : "Save"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * The sub-account is part of every record's identity in CostGraph, and CostGraph never deletes
 * what it has ingested — changing it after a push would count the history twice. So it is chosen
 * once, before anything is sent.
 */
function SubAccountField({ value, onChange, locked }: { value: string; onChange: (value: string) => void; locked: boolean }) {
    const option = SUB_ACCOUNT_OPTIONS.find((o) => o.value === value);
    return (
        <div className="space-y-2">
            <Label className="text-xs">Sub-account</Label>
            {locked ? (
                <div className="flex h-8 items-center justify-between rounded-md border border-border/40 bg-muted/30 px-3 text-xs">
                    <span>{option?.label ?? value}</span>
                    <Lock className="size-3 text-muted-foreground" />
                </div>
            ) : (
                <Select value={value} onValueChange={onChange}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {SUB_ACCOUNT_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            <p className="text-[11px] leading-5 text-muted-foreground">
                {locked
                    ? "Fixed once usage has been sent: CostGraph keeps every record it receives, so changing this would count your history twice."
                    : option?.hint}
            </p>
        </div>
    );
}

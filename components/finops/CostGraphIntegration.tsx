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

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Send } from "lucide-react";

/** CostGraph's mark, from their brand assets (public/integrations/costgraph.svg). */
const costGraphLogo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/integrations/costgraph.svg" alt="" width={18} height={18} className="size-[18px]" />
);
import { Button } from "@/components/ui/button";
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
import { CardShell } from "@/components/integrations/CardShell";
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
    unsupported: "CostGraph doesn't support connecting from Cencori yet.",
    unavailable: "Connecting CostGraph from Cencori isn't available yet.",
    invalid_scope: "CostGraph didn't allow the permissions Cencori asked for.",
};

/* ---------- Card pieces ---------- */

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex min-h-12 items-center justify-between gap-6 px-5 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`truncate text-right text-[13px] font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
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
                layout="compact"
                logo={costGraphLogo}
                title="CostGraph"
                description="Cost infrastructure for enterprise teams."
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

    // Option C only: Connect runs "Sign in with CostGraph". Until CostGraph offers focus:write over
    // OAuth (COSTGRAPH_OAUTH_ENABLED), the button is there but disabled.
    const connectAction = (
        <Button size="sm" className="h-7 px-3 text-xs" disabled={!settings.oauthAvailable} onClick={startOAuth}>
            Connect
        </Button>
    );
    const availableSoon = !connection && !settings.oauthAvailable ? (
        <span className="ml-auto shrink-0 rounded-full border border-border/40 bg-background/25 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Available soon
        </span>
    ) : undefined;

    return (
        <CardShell
            layout="compact"
            logo={costGraphLogo}
            title="CostGraph"
            description="Cost infrastructure for enterprise teams."
            bottomActionDivided={Boolean(connection)}
            bottomAction={connection ? (
                <>
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
                </>
            ) : settings.pendingTenants ? null : <>{connectAction}{availableSoon}</>}
        >
            {settings.pendingTenants && !connection ? (
                <TenantPicker orgSlug={orgSlug} tenants={settings.pendingTenants} onDone={refresh} />
            ) : connection && (
                <div className="divide-y divide-border/30 border-t border-border/30">
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
                </div>
            )}

            {connection && (
                <ManageDialog
                    open={settingsOpen}
                    onOpenChange={setSettingsOpen}
                    orgSlug={orgSlug}
                    connection={connection}
                    oauthAvailable={settings.oauthAvailable}
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

function ManageDialog({
    open,
    onOpenChange,
    orgSlug,
    connection,
    oauthAvailable,
    onReconnect,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgSlug: string;
    connection: CostGraphConnectionView;
    oauthAvailable: boolean;
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

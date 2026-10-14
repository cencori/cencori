"use client";

/**
 * Usage export: organization export keys (read-only, every project) and the CostGraph push.
 *
 * Both send the same thing — Cencori usage as FOCUS 1.2 records (GET /v1/usage/focus) — one by
 * letting a FinOps tool pull it, the other by sending each settled day to CostGraph nightly.
 */

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, FileSpreadsheet, KeyRound, Send } from "lucide-react";
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
    createUsageExportKey,
    deleteCostGraphConnection,
    getUsageExportSettings,
    pushCostGraphNow,
    revokeUsageExportKey,
    saveCostGraphConnection,
    type CostGraphConnectionView,
    type UsageExportSettings as UsageExportSettingsData,
} from "./actions";

const SUB_ACCOUNT_OPTIONS = [
    { value: "project", label: "Project", hint: "Each Cencori project is a sub-account." },
    { value: "end_user", label: "End user", hint: "The end user id you send with requests — your customers." },
    { value: "tenant", label: "Tenant", hint: "Embedded-agent tenants." },
    { value: "none", label: "None", hint: "Leave the sub-account column empty." },
] as const;

export function UsageExportSettings({ orgSlug }: { orgSlug: string }) {
    const queryKey = ["usageExportSettings", orgSlug];
    const { data, isLoading, error } = useQuery<UsageExportSettingsData>({
        queryKey,
        queryFn: async () => {
            const result = await getUsageExportSettings(orgSlug);
            if (!result.ok || !result.data) throw new Error(result.error || "Could not load settings");
            return result.data;
        },
        staleTime: 30 * 1000,
    });

    if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;
    if (error || !data) {
        return (
            <div className="rounded-lg border border-border/35 bg-muted/30 px-5 py-4 text-xs text-muted-foreground">
                {error instanceof Error ? error.message : "Could not load usage export settings."}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <ExportKeysCard orgSlug={orgSlug} keys={data.keys} queryKey={queryKey} />
            <CostGraphCard orgSlug={orgSlug} connection={data.costgraph} queryKey={queryKey} />
        </div>
    );
}

function CardShell({
    icon: Icon,
    title,
    description,
    action,
    children,
    footer,
}: {
    icon: typeof KeyRound;
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

/* ---------- Export keys ---------- */

function ExportKeysCard({
    orgSlug,
    keys,
    queryKey,
}: {
    orgSlug: string;
    keys: UsageExportSettingsData["keys"];
    queryKey: string[];
}) {
    const queryClient = useQueryClient();
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("FinOps export");
    const [revealed, setRevealed] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const create = useMutation({
        mutationFn: async () => {
            const result = await createUsageExportKey(orgSlug, name);
            if (!result.ok || !result.data) throw new Error(result.error || "Could not create the key");
            return result.data;
        },
        onSuccess: (created) => {
            setRevealed(created.key);
            void queryClient.invalidateQueries({ queryKey });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const revoke = useMutation({
        mutationFn: async (keyId: string) => {
            const result = await revokeUsageExportKey(orgSlug, keyId);
            if (!result.ok) throw new Error(result.error || "Could not revoke the key");
        },
        onSuccess: () => {
            toast.success("Export key revoked.");
            void queryClient.invalidateQueries({ queryKey });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const closeDialog = (open: boolean) => {
        setCreateOpen(open);
        if (!open) {
            setRevealed(null);
            setCopied(false);
            setName("FinOps export");
        }
    };

    return (
        <CardShell
            icon={KeyRound}
            title="Usage export keys"
            description="Read-only keys for FinOps tools. Each reads FOCUS 1.2 usage for every project in this organization from GET /v1/usage/focus, and cannot call models or change anything."
            action={
                <Button size="sm" className="h-7 self-start px-3 text-xs" onClick={() => setCreateOpen(true)}>
                    Create key
                </Button>
            }
            footer="Project secret keys can read the same endpoint for their own project. Export keys exist so a FinOps tool never holds a key that can spend."
        >
            <div className="divide-y divide-border/30 border-t border-border/30">
                {keys.length === 0 ? (
                    <p className="px-5 py-4 text-xs text-muted-foreground">No export keys yet.</p>
                ) : (
                    keys.map((key) => (
                        <div key={key.id} className="flex min-h-12 items-center justify-between gap-4 px-5 py-3">
                            <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium">{key.name}</p>
                                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                    {key.key_prefix} · {key.last_used_at ? `used ${new Date(key.last_used_at).toLocaleDateString()}` : "never used"}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                disabled={revoke.isPending}
                                onClick={() => revoke.mutate(key.id)}
                            >
                                Revoke
                            </Button>
                        </div>
                    ))
                )}
            </div>

            <Dialog open={createOpen} onOpenChange={closeDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-sm">{revealed ? "Copy your export key" : "Create a usage export key"}</DialogTitle>
                        <DialogDescription className="text-xs leading-5">
                            {revealed
                                ? "This is the only time the key is shown. Store it in your FinOps tool now."
                                : "Name it after the tool that will use it, so you know what to revoke later."}
                        </DialogDescription>
                    </DialogHeader>
                    {revealed ? (
                        <div className="flex items-center gap-2">
                            <Input readOnly value={revealed} className="h-8 font-mono text-xs" />
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2"
                                onClick={async () => {
                                    await navigator.clipboard.writeText(revealed);
                                    setCopied(true);
                                }}
                                aria-label="Copy key"
                            >
                                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="export-key-name" className="text-xs">Name</Label>
                            <Input
                                id="export-key-name"
                                value={name}
                                maxLength={64}
                                onChange={(event) => setName(event.target.value)}
                                className="h-8 text-xs"
                            />
                        </div>
                    )}
                    <DialogFooter>
                        {revealed ? (
                            <Button size="sm" className="h-7 px-3 text-xs" onClick={() => closeDialog(false)}>Done</Button>
                        ) : (
                            <Button
                                size="sm"
                                className="h-7 px-3 text-xs"
                                disabled={create.isPending || !name.trim()}
                                onClick={() => create.mutate()}
                            >
                                {create.isPending ? "Creating…" : "Create key"}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </CardShell>
    );
}

/* ---------- CostGraph push ---------- */

function CostGraphCard({
    orgSlug,
    connection,
    queryKey,
}: {
    orgSlug: string;
    connection: CostGraphConnectionView | null;
    queryKey: string[];
}) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [connectionId, setConnectionId] = useState(connection?.connectionId ?? "");
    const [apiKey, setApiKey] = useState("");
    const [subAccount, setSubAccount] = useState<string>(connection?.subAccount ?? "project");
    const [enabled, setEnabled] = useState(connection?.enabled ?? true);

    const openDialog = () => {
        setConnectionId(connection?.connectionId ?? "");
        setApiKey("");
        setSubAccount(connection?.subAccount ?? "project");
        setEnabled(connection?.enabled ?? true);
        setOpen(true);
    };

    const save = useMutation({
        mutationFn: async () => {
            const result = await saveCostGraphConnection(orgSlug, { connectionId, apiKey, subAccount, enabled });
            if (!result.ok) throw new Error(result.error || "Could not save");
        },
        onSuccess: () => {
            toast.success(connection ? "CostGraph connection updated." : "CostGraph connected. The first push sends this month so far.");
            setOpen(false);
            void queryClient.invalidateQueries({ queryKey });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const pushNow = useMutation({
        mutationFn: async () => {
            const result = await pushCostGraphNow(orgSlug);
            if (!result.ok) throw new Error(result.error || "The push failed");
            return result.data;
        },
        onSuccess: (view) => {
            toast.success(view && view.sentRows > 0 ? `Sent ${view.sentRows} FOCUS rows to CostGraph.` : "CostGraph is up to date.");
            void queryClient.invalidateQueries({ queryKey });
        },
        onError: (err: Error) => {
            toast.error(err.message);
            void queryClient.invalidateQueries({ queryKey });
        },
    });

    const disconnect = useMutation({
        mutationFn: async () => {
            const result = await deleteCostGraphConnection(orgSlug);
            if (!result.ok) throw new Error(result.error || "Could not disconnect");
        },
        onSuccess: () => {
            toast.success("CostGraph disconnected.");
            setOpen(false);
            void queryClient.invalidateQueries({ queryKey });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const status = !connection
        ? "Not connected"
        : !connection.enabled
            ? "Paused"
            : connection.lastRunStatus === "error"
                ? "Last push failed"
                : connection.lastRunAt
                    ? "Active"
                    : "Waiting for first push";

    return (
        <CardShell
            icon={FileSpreadsheet}
            title="CostGraph"
            description="Send each settled day of usage to CostGraph as FOCUS 1.2, so AI spend through Cencori sits beside the rest of your cloud bill. Runs nightly; closed months are re-sent so late usage corrects itself."
            action={
                <div className="flex gap-2 self-start">
                    {connection && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs"
                            disabled={pushNow.isPending || !connection.enabled}
                            onClick={() => pushNow.mutate()}
                        >
                            <Send className="mr-1.5 size-3" />
                            {pushNow.isPending ? "Sending…" : "Send now"}
                        </Button>
                    )}
                    <Button size="sm" className="h-7 px-3 text-xs" onClick={openDialog}>
                        {connection ? "Edit" : "Connect"}
                    </Button>
                </div>
            }
            footer={
                <>
                    In CostGraph, open Settings → Integrations → FOCUS push to create the connection (fpc_…), and Settings → API keys for a key with the focus:write scope. Usage is reported at what Cencori billed; BYOK usage reports zero, because your provider bills it directly.
                </>
            }
        >
            <div className="divide-y divide-border/30 border-t border-border/30">
                <Row label="Status" value={status} />
                {connection && (
                    <>
                        <Row label="Connection" value={connection.connectionId} mono />
                        <Row label="API key" value={connection.apiKeyHint} mono />
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

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-sm">{connection ? "Edit CostGraph connection" : "Connect CostGraph"}</DialogTitle>
                        <DialogDescription className="text-xs leading-5">
                            Cencori pushes FOCUS records to this connection with this key. The key is encrypted at rest and never shown again.
                        </DialogDescription>
                    </DialogHeader>
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
                            <Label htmlFor="cg-key" className="text-xs">API key {connection && <span className="text-muted-foreground">(leave empty to keep {connection.apiKeyHint})</span>}</Label>
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
                        <div className="space-y-2">
                            <Label className="text-xs">Sub-account</Label>
                            <Select value={subAccount} onValueChange={setSubAccount}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SUB_ACCOUNT_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value} className="text-xs">
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] leading-5 text-muted-foreground">
                                {SUB_ACCOUNT_OPTIONS.find((o) => o.value === subAccount)?.hint}
                            </p>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="cg-enabled" className="text-xs">Push nightly</Label>
                            <Switch id="cg-enabled" checked={enabled} onCheckedChange={setEnabled} />
                        </div>
                        <DialogFooter className="gap-2 sm:justify-between">
                            {connection ? (
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
                            ) : <span />}
                            <Button type="submit" size="sm" className="h-7 px-3 text-xs" disabled={save.isPending}>
                                {save.isPending ? "Saving…" : connection ? "Save" : "Connect"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </CardShell>
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

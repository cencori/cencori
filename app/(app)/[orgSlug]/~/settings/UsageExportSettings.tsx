"use client";

/**
 * Usage export keys: read-only organization keys a FinOps tool uses to pull FOCUS 1.2 usage from
 * GET /v1/usage/focus. The CostGraph push lives on a project's Settings → Integrations
 * (components/finops/CostGraphIntegration.tsx).
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { CardShell, usageExportQueryKey } from "@/components/finops/CostGraphIntegration";
import {
    createUsageExportKey,
    getUsageExportSettings,
    revokeUsageExportKey,
    type UsageExportSettings as UsageExportSettingsData,
} from "./actions";

export function UsageExportSettings({ orgSlug }: { orgSlug: string }) {
    const queryKey = usageExportQueryKey(orgSlug);
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
            <p className="px-1 text-[11px] leading-5 text-muted-foreground">
                CostGraph is connected from any project&apos;s Settings → Integrations. The connection applies to the whole organization.
            </p>
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


"use client";

import { use, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PORTER_QUERY_KEY, usePorter } from "../shared";
import { PorterHeader, NoPorter } from "../PorterHeader";

export default function PorterKnowledgePage({
    params,
}: {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
    const { orgSlug, projectSlug } = use(params);
    const { data: porter, isLoading } = usePorter(orgSlug, projectSlug);
    const queryClient = useQueryClient();
    const [lastRead, setLastRead] = useState<{ indexed: number; skipped: number; failed: number } | null>(null);

    const readSite = useMutation({
        mutationFn: async (porterId: string) => {
            const response = await fetch(`/api/porter/${porterId}/crawl`, { method: "POST" });
            const result = await response.json();
            if (!response.ok) throw new Error([result?.error, result?.detail].filter(Boolean).join(" — "));
            return result as { indexed: number; skipped: number; failed: number };
        },
        onSuccess: async (result) => {
            setLastRead(result);
            if (result.indexed === 0) toast.error("Nothing could be read from that site.");
            else toast.success(`Read ${result.indexed} page${result.indexed === 1 ? "" : "s"}.`);
            await queryClient.invalidateQueries({ queryKey: PORTER_QUERY_KEY(orgSlug, projectSlug) });
        },
        onError: (error: Error) => toast.error(error.message || "Could not read the site."),
    });

    if (isLoading) return <div className="mx-auto w-full max-w-3xl px-6 py-12 text-sm text-muted-foreground">…</div>;
    if (!porter) return <div className="mx-auto w-full max-w-3xl px-6 py-12"><NoPorter orgSlug={orgSlug} projectSlug={projectSlug} /></div>;

    return (
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
            <PorterHeader
                porter={porter}
                title="Knowledge"
                description="Your Porter answers only from pages it has read on your own site. It re-reads them weekly, and a page whose text has not changed is left alone."
            />

            <dl className="divide-y divide-border border-y border-border">
                <div className="flex items-baseline justify-between gap-6 py-3">
                    <dt className="text-sm text-muted-foreground">Answering</dt>
                    <dd className="font-mono text-xs">
                        {porter.enabled ? "yes" : "not yet — its site hasn't been read"}
                    </dd>
                </div>
                <div className="flex items-baseline justify-between gap-6 py-3">
                    <dt className="text-sm text-muted-foreground">Collection</dt>
                    <dd className="font-mono text-xs">{porter.collection_id ?? "none yet"}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-6 py-3">
                    <dt className="text-sm text-muted-foreground">Refresh</dt>
                    <dd className="font-mono text-xs">weekly</dd>
                </div>
            </dl>

            <div className="mt-8 rounded border border-border p-5">
                <p className="text-sm font-medium">
                    {porter.enabled ? "Read your site again" : "Your Porter has not read your site yet"}
                </p>
                <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                    It follows links from {porter.source_url}, up to 25 pages, and answers only from what it
                    finds there. Nothing is published to your site by doing this.
                </p>
                <Button className="mt-4" disabled={readSite.isPending} onClick={() => readSite.mutate(porter.id)}>
                    {readSite.isPending ? "Reading your site…" : porter.enabled ? "Read it again" : "Read my site"}
                </Button>
                {lastRead && (
                    <p className="mt-3 font-mono text-xs text-muted-foreground">
                        {lastRead.indexed} indexed · {lastRead.skipped} skipped · {lastRead.failed} failed
                    </p>
                )}
            </div>
        </div>
    );
}

"use client";

import { use, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PORTER_QUERY_KEY, usePorter } from "../shared";
import { PorterHeader, NoPorter } from "../PorterHeader";

type Discovered = {
    total: number;
    source: "sitemap" | "homepage";
    groups: { path: string; urls: string[] }[];
};

type ReadSummary = { indexed: number; skipped: number; failed: number };

/** A Porter reads 25 pages, so the choice of which 25 is the customer's to make. */
const PAGE_BUDGET = 25;

export default function PorterKnowledgePage({
    params,
}: {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
    const { orgSlug, projectSlug } = use(params);
    const { data: porter, isLoading } = usePorter(orgSlug, projectSlug);
    const queryClient = useQueryClient();

    const [found, setFound] = useState<Discovered | null>(null);
    const [excluded, setExcluded] = useState<Set<string>>(new Set());
    const [lastRead, setLastRead] = useState<ReadSummary | null>(null);

    const discover = useMutation({
        mutationFn: async (porterId: string) => {
            const response = await fetch(`/api/porter/${porterId}/discover`, { method: "POST" });
            const result = await response.json();
            if (!response.ok) throw new Error(result?.error || "Could not read that site.");
            return result as Discovered;
        },
        onSuccess: (result) => {
            setFound(result);
            setExcluded(new Set());
            if (result.total === 0) toast.error("No pages could be found on that site.");
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const selected = useMemo(() => {
        if (!found) return [];
        return found.groups
            .filter((group) => !excluded.has(group.path))
            .flatMap((group) => group.urls)
            .slice(0, PAGE_BUDGET);
    }, [found, excluded]);

    const readSite = useMutation({
        mutationFn: async (porterId: string) => {
            const response = await fetch(`/api/porter/${porterId}/crawl`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(selected.length > 0 ? { urls: selected } : {}),
            });
            const result = await response.json();
            if (!response.ok) throw new Error([result?.error, result?.detail].filter(Boolean).join(" — "));
            return result as ReadSummary;
        },
        onSuccess: async (result) => {
            setLastRead(result);
            if (result.indexed === 0) toast.error("Nothing could be read from those pages.");
            else toast.success(`Read ${result.indexed} page${result.indexed === 1 ? "" : "s"}.`);
            await queryClient.invalidateQueries({ queryKey: PORTER_QUERY_KEY(orgSlug, projectSlug) });
        },
        onError: (error: Error) => toast.error(error.message || "Could not read the site."),
    });

    if (isLoading) return <div className="mx-auto w-full max-w-3xl px-6 py-12 text-sm text-muted-foreground">…</div>;
    if (!porter) return <div className="mx-auto w-full max-w-3xl px-6 py-12"><NoPorter orgSlug={orgSlug} projectSlug={projectSlug} /></div>;

    const busy = discover.isPending || readSite.isPending;

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
                    <dt className="text-sm text-muted-foreground">Page allowance</dt>
                    <dd className="font-mono text-xs">{PAGE_BUDGET}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-6 py-3">
                    <dt className="text-sm text-muted-foreground">Refresh</dt>
                    <dd className="font-mono text-xs">weekly</dd>
                </div>
            </dl>

            {!found ? (
                <div className="mt-8 rounded border border-border p-5">
                    <p className="text-sm font-medium">
                        {porter.enabled ? "Read your site again" : "Choose what your Porter reads"}
                    </p>
                    <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                        We&apos;ll look at what {porter.source_url} contains and show you the sections before
                        anything is read, so your {PAGE_BUDGET} pages go where you want them. Nothing is
                        published to your site by doing this.
                    </p>
                    <Button className="mt-4" disabled={busy} onClick={() => discover.mutate(porter.id)}>
                        {discover.isPending ? "Looking…" : "Find my pages"}
                    </Button>
                    {lastRead && (
                        <p className="mt-3 font-mono text-xs text-muted-foreground">
                            {lastRead.indexed} indexed · {lastRead.skipped} skipped · {lastRead.failed} failed
                        </p>
                    )}
                </div>
            ) : (
                <section className="mt-8">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <h2 className="text-sm font-medium">
                            {found.total} page{found.total === 1 ? "" : "s"} found
                        </h2>
                        <span className="font-mono text-[11px] text-muted-foreground">
                            from {found.source === "sitemap" ? "your sitemap" : "your homepage links"}
                        </span>
                    </div>
                    <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                        Uncheck anything your customers would never ask about. The first {PAGE_BUDGET} of what
                        remains get read.
                    </p>

                    <ul className="mt-4 divide-y divide-border border-y border-border">
                        {found.groups.map((group) => {
                            const on = !excluded.has(group.path);
                            return (
                                <li key={group.path}>
                                    <label className="flex cursor-pointer items-center gap-3 py-3">
                                        <input
                                            type="checkbox"
                                            checked={on}
                                            disabled={busy}
                                            onChange={() =>
                                                setExcluded((current) => {
                                                    const next = new Set(current);
                                                    if (on) next.add(group.path);
                                                    else next.delete(group.path);
                                                    return next;
                                                })
                                            }
                                            className="size-4 accent-foreground"
                                        />
                                        <span className="flex-1 font-mono text-xs">{group.path}</span>
                                        <span className="font-mono text-[11px] text-muted-foreground">
                                            {group.urls.length} page{group.urls.length === 1 ? "" : "s"}
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <Button
                            disabled={busy || selected.length === 0}
                            onClick={() => readSite.mutate(porter.id)}
                        >
                            {readSite.isPending
                                ? "Reading your site…"
                                : `Read ${selected.length} page${selected.length === 1 ? "" : "s"}`}
                        </Button>
                        <button
                            type="button"
                            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
                            disabled={busy}
                            onClick={() => setFound(null)}
                        >
                            Start over
                        </button>
                        {found.total > PAGE_BUDGET && selected.length === PAGE_BUDGET && (
                            <span className="font-mono text-[11px] text-muted-foreground">
                                allowance reached — uncheck a section to choose differently
                            </span>
                        )}
                    </div>

                    {lastRead && (
                        <p className="mt-4 font-mono text-xs text-muted-foreground">
                            {lastRead.indexed} indexed · {lastRead.skipped} skipped · {lastRead.failed} failed
                        </p>
                    )}
                </section>
            )}
        </div>
    );
}

"use client";

import { use } from "react";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/**
 * Placeholder for the Porter workspace.
 *
 * Onboarding provisions a Porter and lands here, so this page exists to prove the provisioning
 * worked: it names the site the Porter was built from and whether it is answering yet. The crawl
 * view, the live preview and the snippet replace this as the later steps land.
 */

type PorterAction = { type?: string; to?: string; source?: string };

type PorterRow = {
    id: string;
    name: string;
    source_url: string;
    enabled: boolean;
    surface: string;
    created_at: string;
    system_prompt: string | null;
    publishable_key: string | null;
    brand: { color?: string; logo?: string } | null;
    brand_overrides: Record<string, unknown> | null;
    actions: PorterAction[] | null;
};

export default function PorterPage({
    params,
}: {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
    const { orgSlug, projectSlug } = use(params);

    const queryClient = useQueryClient();
    const [lastRead, setLastRead] = useState<{ indexed: number; skipped: number; failed: number } | null>(null);

    const { data: porter, isLoading } = useQuery({
        // The key names the shape being fetched, not just the row. staleTime is five minutes and
        // refetchOnMount is off, so widening the select below without changing this key serves the
        // narrower cached row and the new columns silently render as absent.
        queryKey: ["porter", orgSlug, projectSlug, "with-snippet"],
        queryFn: async (): Promise<PorterRow | null> => {
            const { data: project } = await supabase
                .from("projects")
                .select("id, organizations!inner(slug)")
                .eq("slug", projectSlug)
                .eq("organizations.slug", orgSlug)
                .maybeSingle();

            if (!project) return null;

            const { data } = await supabase
                .from("porters")
                .select("id, name, source_url, enabled, surface, created_at, system_prompt, brand, brand_overrides, actions, publishable_key")
                .eq("project_id", project.id)
                .maybeSingle();

            return (data as PorterRow) ?? null;
        },
    });

    const [copied, setCopied] = useState(false);

    const snippet = porter?.publishable_key
        ? `<script src="https://cdn.cencori.com/porter.js"\n        data-porter="${porter.id}"\n        data-key="${porter.publishable_key}"\n        defer></script>`
        : null;

    const issueKey = useMutation({
        mutationFn: async (porterId: string) => {
            const response = await fetch(`/api/porter/${porterId}/key`, { method: "POST" });
            const result = await response.json();
            if (!response.ok) throw new Error(result?.error || "Could not issue a key.");
            return result;
        },
        onSuccess: async () => {
            toast.success("A new key is ready. The old one no longer works.");
            await queryClient.invalidateQueries({
                queryKey: ["porter", orgSlug, projectSlug, "with-snippet"],
            });
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const copySnippet = async () => {
        if (!snippet) return;
        try {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Could not copy. Select the snippet and copy it manually.");
        }
    };

    const readSite = useMutation({
        mutationFn: async (porterId: string) => {
            const response = await fetch(`/api/porter/${porterId}/crawl`, { method: "POST" });
            const result = await response.json();
            if (!response.ok) throw new Error([result?.error, result?.detail].filter(Boolean).join(" — "));
            return result as { indexed: number; skipped: number; failed: number; answering: boolean };
        },
        onSuccess: async (result) => {
            setLastRead(result);
            if (result.indexed === 0) {
                toast.error("Nothing could be read from that site.");
            } else {
                toast.success(`Read ${result.indexed} page${result.indexed === 1 ? "" : "s"}.`);
            }
            await queryClient.invalidateQueries({ queryKey: ["porter", orgSlug, projectSlug, "with-snippet"] });
        },
        onError: (error: Error) => toast.error(error.message || "Could not read the site."),
    });

    const value = (text: string) => (isLoading ? "…" : text);

    return (
        <div className="mx-auto w-full max-w-2xl px-6 py-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Porter
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
                {isLoading ? "…" : porter?.name ?? "No Porter here yet"}
            </h1>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                {porter
                    ? "Your Porter exists and its key is locked to the site below. Reading your pages, so it has something to answer with, comes next."
                    : "This project has no Porter. One is created when you set up through the Porter path in onboarding."}
            </p>

            {porter && (
                <dl className="mt-10 divide-y divide-border border-y border-border">
                    <div className="flex items-baseline justify-between gap-6 py-3">
                        <dt className="text-sm text-muted-foreground">Site</dt>
                        <dd className="font-mono text-xs">{value(porter.source_url)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-6 py-3">
                        <dt className="text-sm text-muted-foreground">Answering</dt>
                        <dd className="font-mono text-xs">
                            {porter.enabled ? "yes" : "not yet — its site hasn't been read"}
                        </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-6 py-3">
                        <dt className="text-sm text-muted-foreground">Surface</dt>
                        <dd className="font-mono text-xs">{value(porter.surface)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-6 py-3">
                        <dt className="text-sm text-muted-foreground">Workspace</dt>
                        <dd className="font-mono text-xs">
                            {orgSlug}/{projectSlug}
                        </dd>
                    </div>
                </dl>
            )}

            {porter && !porter.enabled && (
                <div className="mt-8 rounded border border-border p-5">
                    <p className="text-sm font-medium">Your Porter has not read your site yet</p>
                    <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                        It will follow links from {porter.source_url}, up to 25 pages, and answer only from
                        what it finds there. Nothing is published to your site by doing this.
                    </p>
                    <Button
                        className="mt-4"
                        disabled={readSite.isPending}
                        onClick={() => readSite.mutate(porter.id)}
                    >
                        {readSite.isPending ? "Reading your site…" : "Read my site"}
                    </Button>
                    {lastRead && lastRead.indexed === 0 && (
                        <p className="mt-3 font-mono text-xs text-muted-foreground">
                            {lastRead.skipped} skipped · {lastRead.failed} failed · nothing indexed
                        </p>
                    )}
                </div>
            )}

            {porter?.enabled && lastRead && (
                <p className="mt-8 font-mono text-xs text-muted-foreground">
                    Read {lastRead.indexed} pages · {lastRead.skipped} skipped · {lastRead.failed} failed
                </p>
            )}

            {porter && (
                <section className="mt-10">
                    <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Put it on your site
                    </h2>
                    <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                        Paste this once, anywhere in the page. It only works on{" "}
                        {(porter.source_url || "").replace(/^https?:\/\//, "")} — the key is locked to
                        that domain, so it is safe to leave in your page source.
                    </p>

                    {snippet ? (
                        <>
                            <pre className="mt-4 overflow-x-auto rounded border border-border bg-muted/40 p-4 text-xs leading-relaxed">
                                <code>{snippet}</code>
                            </pre>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                <Button size="sm" onClick={copySnippet}>
                                    {copied ? "Copied" : "Copy snippet"}
                                </Button>
                                <a
                                    className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
                                    href={`mailto:?subject=${encodeURIComponent(
                                        `Please add this to ${(porter.source_url || "").replace(/^https?:\/\//, "")}`
                                    )}&body=${encodeURIComponent(
                                        `Hi — please paste this line into our site. It adds an assistant that answers questions from our own pages.\n\n${snippet}\n\nIt only works on our domain, so it is safe to leave in the page source.`
                                    )}`}
                                >
                                    Send to a developer
                                </a>
                                <button
                                    type="button"
                                    className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
                                    disabled={issueKey.isPending}
                                    onClick={() => issueKey.mutate(porter.id)}
                                >
                                    {issueKey.isPending ? "Issuing…" : "Replace the key"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="mt-4 rounded border border-border p-5">
                            <p className="text-sm">This Porter has no key yet.</p>
                            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                                Porters created before keys were kept cannot show their original one, because
                                only its hash was stored. Issue a new one to get your snippet.
                            </p>
                            <Button
                                className="mt-4"
                                disabled={issueKey.isPending}
                                onClick={() => issueKey.mutate(porter.id)}
                            >
                                {issueKey.isPending ? "Issuing…" : "Issue a key"}
                            </Button>
                        </div>
                    )}
                </section>
            )}

            {porter && (
                <section className="mt-10">
                    <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Read from your site
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Taken from {porter.source_url} when your Porter was created. Editing any of it
                        later keeps your version through the weekly refresh.
                    </p>

                    <dl className="mt-5 divide-y divide-border border-y border-border">
                        <div className="flex items-center justify-between gap-6 py-3">
                            <dt className="text-sm text-muted-foreground">Name</dt>
                            <dd className="text-sm font-medium">{porter.name}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-6 py-3">
                            <dt className="text-sm text-muted-foreground">Brand colour</dt>
                            <dd className="flex items-center gap-2 font-mono text-xs">
                                {porter.brand?.color ? (
                                    <>
                                        <span
                                            aria-hidden
                                            className="inline-block size-4 rounded border border-border"
                                            style={{ background: porter.brand.color }}
                                        />
                                        {porter.brand.color}
                                    </>
                                ) : (
                                    <span className="text-muted-foreground">none found</span>
                                )}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-6 py-3">
                            <dt className="text-sm text-muted-foreground">Logo</dt>
                            <dd className="flex min-w-0 items-center gap-3">
                                {porter.brand?.logo ? (
                                    <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={porter.brand.logo}
                                            alt=""
                                            className="size-8 rounded border border-border object-cover"
                                        />
                                        <span className="truncate font-mono text-xs text-muted-foreground">
                                            {porter.brand.logo}
                                        </span>
                                    </>
                                ) : (
                                    <span className="font-mono text-xs text-muted-foreground">none found</span>
                                )}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-6 py-3">
                            <dt className="text-sm text-muted-foreground">Escalates to</dt>
                            <dd className="font-mono text-xs">
                                {porter.actions?.find((a) => a.type === "email")?.to ?? (
                                    <span className="text-muted-foreground">no address on the page</span>
                                )}
                            </dd>
                        </div>
                    </dl>

                    <div className="mt-6">
                        <p className="text-sm text-muted-foreground">What it has been told about you</p>
                        <p className="mt-2 rounded border border-border bg-muted/40 p-4 text-sm leading-relaxed">
                            {porter.system_prompt ?? "Nothing yet — your site could not be read."}
                        </p>
                    </div>
                </section>
            )}

            <p className="mt-8 text-sm text-muted-foreground">
                Nothing is live on your site yet.{" "}
                <Link href={`/${orgSlug}/${projectSlug}`} className="underline underline-offset-4">
                    Open the project
                </Link>{" "}
                to see what else is here.
            </p>
        </div>
    );
}

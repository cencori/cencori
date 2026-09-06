"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { hostOf, usePorter } from "./shared";
import { PorterHeader, NoPorter } from "./PorterHeader";

type Turn = { id: string; question: string; grounded: boolean; status: string };

/**
 * The state of a Porter in one screen.
 *
 * Everything here is a summary that leads somewhere else. The detail lives on the pages the sidebar
 * lists, so this can answer the only question someone opens it for -- is it working, and is anyone
 * using it -- without becoming the place every feature accumulates.
 */
export default function PorterOverviewPage({
    params,
}: {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
    const { orgSlug, projectSlug } = use(params);
    const { data: porter, isLoading } = usePorter(orgSlug, projectSlug);

    const { data: turns } = useQuery({
        queryKey: ["porter-turns", porter?.id],
        enabled: Boolean(porter?.id),
        queryFn: async (): Promise<Turn[]> => {
            const response = await fetch(`/api/porter/${porter!.id}/conversations?limit=50`);
            if (!response.ok) return [];
            return ((await response.json()).turns ?? []) as Turn[];
        },
    });

    if (isLoading) return <div className="mx-auto w-full max-w-3xl px-6 py-12 text-sm text-muted-foreground">…</div>;
    if (!porter) return <div className="mx-auto w-full max-w-3xl px-6 py-12"><NoPorter orgSlug={orgSlug} projectSlug={projectSlug} /></div>;

    const base = `/${orgSlug}/${projectSlug}/porter`;
    const unsourced = (turns ?? []).filter((turn) => !turn.grounded).length;

    const state = !porter.enabled
        ? { label: "Not answering", detail: "Its site has not been read yet.", href: `${base}/knowledge`, action: "Read the site" }
        : !porter.publishable_key
            ? { label: "Ready, not installed", detail: "It can answer, but has no snippet to install.", href: `${base}/install`, action: "Get the snippet" }
            : { label: "Answering", detail: `Live on ${hostOf(porter)} once the snippet is on the page.`, href: `${base}/install`, action: "View the snippet" };

    return (
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
            <PorterHeader porter={porter} title={porter.name} />

            <div className="rounded border border-border p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">{state.label}</p>
                    <Link href={state.href} className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground">
                        {state.action}
                    </Link>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{state.detail}</p>
            </div>

            <dl className="mt-8 grid gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-3">
                <div className="bg-background p-4">
                    <dt className="text-xs text-muted-foreground">Questions asked</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">{turns?.length ?? "—"}</dd>
                </div>
                <div className="bg-background p-4">
                    <dt className="text-xs text-muted-foreground">Answered without sources</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">{turns ? unsourced : "—"}</dd>
                </div>
                <div className="bg-background p-4">
                    <dt className="text-xs text-muted-foreground">Refresh</dt>
                    <dd className="mt-1 text-2xl font-semibold">Weekly</dd>
                </div>
            </dl>

            {turns && turns.length > 0 && (
                <section className="mt-8">
                    <div className="flex items-baseline justify-between gap-4">
                        <h2 className="text-sm font-medium">Recent questions</h2>
                        <Link href={`${base}/conversations`} className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground">
                            All conversations
                        </Link>
                    </div>
                    <ul className="mt-3 divide-y divide-border border-y border-border">
                        {turns.slice(0, 5).map((turn) => (
                            <li key={turn.id} className="flex items-baseline justify-between gap-4 py-3">
                                <p className="text-sm">{turn.question}</p>
                                {!turn.grounded && (
                                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">unsourced</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

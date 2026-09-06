"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePorter } from "../shared";
import { PorterHeader, NoPorter } from "../PorterHeader";

type Turn = {
    id: string;
    askedAt: string;
    question: string;
    answer: string;
    status: string;
    latencyMs: number | null;
    grounded: boolean;
};

export default function PorterConversationsPage({
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

    return (
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
            <PorterHeader
                porter={porter}
                title="Conversations"
                description="What visitors have asked, and what your Porter said back. An answer marked unsourced was given without any of your pages to draw on — that is where your site has a gap."
            />

            {!turns || turns.length === 0 ? (
                <div className="rounded border border-border p-6">
                    <p className="text-sm font-medium">Nothing yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Questions appear here as soon as someone talks to your Porter.
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-border border-y border-border">
                    {turns.map((turn) => (
                        <li key={turn.id} className="py-4">
                            <div className="flex items-baseline justify-between gap-4">
                                <p className="text-sm font-medium">{turn.question}</p>
                                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                                    {new Date(turn.askedAt).toLocaleString()}
                                </span>
                            </div>
                            <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
                                {turn.answer || "No answer was returned."}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-muted-foreground">
                                {turn.status !== "success" && <span>{turn.status}</span>}
                                {!turn.grounded && <span>unsourced</span>}
                                {turn.latencyMs != null && <span>{(turn.latencyMs / 1000).toFixed(1)}s</span>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { PORTER_MODELS } from "@/lib/porter/models";
import { PORTER_QUERY_KEY, hostOf, usePorter } from "./shared";
import { NoPorter } from "./PorterHeader";
import { PorterCanvas } from "./PorterCanvas";

/**
 * A Porter's home: what it is on the left, what it looks like on the right.
 *
 * The right pane is a canvas the widget floats on -- a workbench for dressing it, where a change
 * shows immediately. It is deliberately not the page preview: that lives at /porter-preview, runs
 * the real porter.js, and answers a different question. It also cannot be embedded here at all,
 * since the app sends X-Frame-Options DENY on its own routes.
 *
 * The left pane holds what shapes the Porter. Numbers and transcripts belong to Conversations, and
 * repeating them here made this the page everything accumulates in rather than the page you land on.
 */
export default function PorterOverviewPage({
    params,
}: {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
    const { orgSlug, projectSlug } = use(params);
    const { data: porter, isLoading } = usePorter(orgSlug, projectSlug);
    const queryClient = useQueryClient();
    // Held locally so the picker moves the moment it is clicked, rather than after a round trip.
    const [model, setModel] = useState<string | null | undefined>(undefined);

    const saveModel = useMutation({
        mutationFn: async ({ porterId, value }: { porterId: string; value: string | null }) => {
            const response = await fetch(`/api/porter/${porterId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: value }),
            });
            if (!response.ok) {
                throw new Error((await response.json())?.error || "Could not save that.");
            }
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: PORTER_QUERY_KEY(orgSlug, projectSlug) }),
        onError: (error: Error) => {
            setModel(undefined);
            toast.error(error.message);
        },
    });

    if (isLoading) {
        return <div className="px-6 py-10 text-sm text-muted-foreground">…</div>;
    }
    if (!porter) {
        return (
            <div className="mx-auto w-full max-w-3xl px-6 py-12">
                <NoPorter orgSlug={orgSlug} projectSlug={projectSlug} />
            </div>
        );
    }

    const base = `/${orgSlug}/${projectSlug}/porter`;

    return (
        <div className="flex h-full min-h-0">
            {/* Left: what it is */}
            <div className="w-full shrink-0 overflow-y-auto border-r border-border/30 lg:w-[420px]">
                <div className="space-y-8 p-6">
                    <section>
                        <h2 className="text-sm font-medium">{porter.name}</h2>
                        <a
                            href={porter.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-block font-mono text-xs text-muted-foreground hover:text-foreground"
                        >
                            {hostOf(porter)}
                        </a>
                        {!porter.enabled && (
                            <p className="mt-3 text-sm text-muted-foreground">
                                It has no pages to answer from yet.
                            </p>
                        )}
                        {!porter.enabled && (
                            <Link
                                href={`${base}/knowledge`}
                                className="mt-2 inline-block text-sm underline underline-offset-4"
                            >
                                Choose what it reads
                            </Link>
                        )}
                    </section>

                    <section>
                        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Model
                        </h3>
                        <Select
                            value={(model === undefined ? porter.model : model) ?? "auto"}
                            disabled={saveModel.isPending}
                            onValueChange={(value) => {
                                const next = value === "auto" ? null : value;
                                setModel(next);
                                saveModel.mutate({ porterId: porter.id, value: next });
                            }}
                        >
                            <SelectTrigger className="mt-2 h-9 w-full text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PORTER_MODELS.map((option) => (
                                    <SelectItem key={option.id ?? "auto"} value={option.id ?? "auto"}>
                                        <span className="flex flex-col items-start">
                                            <span className="text-sm">{option.name}</span>
                                            <span className="text-[11px] text-muted-foreground">{option.note}</span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </section>

                    <section>
                        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Instructions
                        </h3>
                        <p className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-[13px] leading-relaxed text-muted-foreground">
                            {porter.system_prompt ?? "Nothing yet — your site could not be read."}
                        </p>
                        <Link
                            href={`${base}/settings`}
                            className="mt-2 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        >
                            Edit in settings
                        </Link>
                    </section>
                </div>
            </div>

            {/* Right: what it looks like */}
            <div className="relative hidden min-w-0 flex-1 lg:block">
                <PorterCanvas porter={porter} />
            </div>
        </div>
    );
}

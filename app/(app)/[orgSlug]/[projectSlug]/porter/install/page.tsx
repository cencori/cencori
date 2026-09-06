"use client";

import { use, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PORTER_QUERY_KEY, hostOf, snippetFor, usePorter } from "../shared";
import { PorterHeader, NoPorter } from "../PorterHeader";

export default function PorterInstallPage({
    params,
}: {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
    const { orgSlug, projectSlug } = use(params);
    const { data: porter, isLoading } = usePorter(orgSlug, projectSlug);
    const queryClient = useQueryClient();
    const [copied, setCopied] = useState(false);

    const issueKey = useMutation({
        mutationFn: async (porterId: string) => {
            const response = await fetch(`/api/porter/${porterId}/key`, { method: "POST" });
            const result = await response.json();
            if (!response.ok) throw new Error(result?.error || "Could not issue a key.");
            return result;
        },
        onSuccess: async () => {
            toast.success("A new key is ready. The old one no longer works.");
            await queryClient.invalidateQueries({ queryKey: PORTER_QUERY_KEY(orgSlug, projectSlug) });
        },
        onError: (error: Error) => toast.error(error.message),
    });

    if (isLoading) return <div className="mx-auto w-full max-w-3xl px-6 py-12 text-sm text-muted-foreground">…</div>;
    if (!porter) return <div className="mx-auto w-full max-w-3xl px-6 py-12"><NoPorter orgSlug={orgSlug} projectSlug={projectSlug} /></div>;

    const snippet = snippetFor(porter);
    const host = hostOf(porter);

    const copy = async () => {
        if (!snippet) return;
        try {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Could not copy. Select the snippet and copy it manually.");
        }
    };

    return (
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
            <PorterHeader
                porter={porter}
                title="Install"
                description={`Paste this once, anywhere in the page. It only works on ${host} — the key is locked to that domain, so it is safe to leave in your page source.`}
            />

            {snippet ? (
                <>
                    <pre className="overflow-x-auto rounded border border-border bg-muted/40 p-4 text-xs leading-relaxed">
                        <code>{snippet}</code>
                    </pre>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Button size="sm" onClick={copy}>{copied ? "Copied" : "Copy snippet"}</Button>
                        <a
                            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                            href={`mailto:?subject=${encodeURIComponent(`Please add this to ${host}`)}&body=${encodeURIComponent(
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
                <div className="rounded border border-border p-5">
                    <p className="text-sm">This Porter has no key yet.</p>
                    <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                        Porters created before keys were kept cannot show their original one, because only
                        its hash was stored. Issue a new one to get your snippet.
                    </p>
                    <Button className="mt-4" disabled={issueKey.isPending} onClick={() => issueKey.mutate(porter.id)}>
                        {issueKey.isPending ? "Issuing…" : "Issue a key"}
                    </Button>
                </div>
            )}
        </div>
    );
}

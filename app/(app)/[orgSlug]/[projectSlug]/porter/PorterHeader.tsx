"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { Porter } from "./shared";
import { PORTER_QUERY_KEY, hostOf } from "./shared";

/** The same identity on every page of the workspace, so a drill-in never loses its subject. */
export function PorterHeader({
    porter,
    title,
    description,
}: {
    porter: Porter | null | undefined;
    title: string;
    description?: string;
}) {
    return (
        <header className="mb-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Porter {porter ? `· ${hostOf(porter)}` : ""}
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
            {description && (
                <p className="mt-2 max-w-prose text-sm text-muted-foreground">{description}</p>
            )}
        </header>
    );
}

/**
 * What a project without a Porter shows.
 *
 * Porter is in the sidebar for everyone, so most people who reach this page arrived out of
 * curiosity rather than intent -- which makes a dead end the wrong answer. It asks for the one
 * thing onboarding asks for, and creates the same Porter.
 */
export function NoPorter({ orgSlug, projectSlug }: { orgSlug: string; projectSlug: string }) {
    const queryClient = useQueryClient();
    const [siteUrl, setSiteUrl] = useState("");

    const { data: projectId } = useQuery({
        queryKey: ["porter-project-id", orgSlug, projectSlug],
        queryFn: async () => {
            const { data } = await supabase
                .from("projects")
                .select("id, organizations!inner(slug)")
                .eq("slug", projectSlug)
                .eq("organizations.slug", orgSlug)
                .maybeSingle();
            return (data?.id as string) ?? null;
        },
    });

    const create = useMutation({
        mutationFn: async () => {
            const response = await fetch("/api/porter/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId, siteUrl: siteUrl.trim() }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error([result?.error, result?.detail].filter(Boolean).join(" — "));
            }
            return result as { name: string };
        },
        onSuccess: async (result) => {
            toast.success(`${result.name} is ready. Read its site next.`);
            await queryClient.invalidateQueries({ queryKey: PORTER_QUERY_KEY(orgSlug, projectSlug) });
        },
        onError: (error: Error) => toast.error(error.message || "Could not create a Porter."),
    });

    return (
        <div className="rounded border border-border p-6">
            <p className="text-sm font-medium">Put an AI agent on your website</p>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                Give it a web address and it reads that site, then answers questions about the business
                from those pages — with citations, and without inventing anything it did not find.
            </p>

            <div className="mt-5 flex max-w-md flex-wrap gap-2">
                <Input
                    value={siteUrl}
                    onChange={(event) => setSiteUrl(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && siteUrl.trim() && projectId) create.mutate();
                    }}
                    placeholder="acme.com"
                    inputMode="url"
                    aria-label="Your website"
                    className="h-9 flex-1"
                    disabled={create.isPending}
                />
                <Button
                    className="h-9"
                    disabled={create.isPending || !siteUrl.trim() || !projectId}
                    onClick={() => create.mutate()}
                >
                    {create.isPending ? "Reading the site…" : "Create a Porter"}
                </Button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
                Nothing goes live on your site until you paste a snippet into it.
            </p>
        </div>
    );
}

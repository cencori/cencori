"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

/**
 * Placeholder for the Porter workspace.
 *
 * Onboarding provisions a Porter and lands here, so this page exists to prove the provisioning
 * worked: it names the site the Porter was built from and whether it is answering yet. The crawl
 * view, the live preview and the snippet replace this as the later steps land.
 */

type PorterRow = {
    id: string;
    name: string;
    source_url: string;
    enabled: boolean;
    surface: string;
    created_at: string;
};

export default function PorterPage({
    params,
}: {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
    const { orgSlug, projectSlug } = use(params);

    const { data: porter, isLoading } = useQuery({
        queryKey: ["porter", orgSlug, projectSlug],
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
                .select("id, name, source_url, enabled, surface, created_at")
                .eq("project_id", project.id)
                .maybeSingle();

            return (data as PorterRow) ?? null;
        },
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

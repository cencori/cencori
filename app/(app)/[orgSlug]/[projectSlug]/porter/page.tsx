"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

/**
 * Placeholder for the Porter workspace.
 *
 * Onboarding provisions a Porter and lands here, so this page exists to prove the
 * provisioning worked: it names the site the Porter was created for and the
 * publishable key that is domain locked to it. The crawl view, the live preview
 * and the snippet replace this as the later steps land.
 */

type PorterKey = {
    name: string;
    key_prefix: string;
    allowed_domains: string[] | null;
};

export default function PorterPage({
    params,
}: {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
    const { orgSlug, projectSlug } = use(params);

    const { data, isLoading } = useQuery({
        queryKey: ["porterStub", orgSlug, projectSlug],
        queryFn: async (): Promise<PorterKey | null> => {
            const { data: project } = await supabase
                .from("projects")
                .select("id, organizations!inner(slug)")
                .eq("slug", projectSlug)
                .eq("organizations.slug", orgSlug)
                .maybeSingle();

            if (!project) return null;

            const { data: key } = await supabase
                .from("api_keys")
                .select("name, key_prefix, allowed_domains")
                .eq("project_id", project.id)
                .eq("key_type", "publishable")
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle();

            return (key as PorterKey) ?? null;
        },
    });

    const domains = data?.allowed_domains ?? [];

    return (
        <div className="mx-auto w-full max-w-2xl px-6 py-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Porter
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
                {domains.length > 0 ? domains[0] : "Your Porter"}
            </h1>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                Your account is set up and a publishable key is waiting, locked to the site below.
                Reading your pages and generating the snippet come next.
            </p>

            <dl className="mt-10 divide-y divide-border border-y border-border">
                <div className="flex items-baseline justify-between gap-6 py-3">
                    <dt className="text-sm text-muted-foreground">Site</dt>
                    <dd className="font-mono text-xs">
                        {isLoading ? "…" : domains.join(", ") || "not set"}
                    </dd>
                </div>
                <div className="flex items-baseline justify-between gap-6 py-3">
                    <dt className="text-sm text-muted-foreground">Publishable key</dt>
                    <dd className="font-mono text-xs">{isLoading ? "…" : data?.key_prefix ?? "not created"}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-6 py-3">
                    <dt className="text-sm text-muted-foreground">Workspace</dt>
                    <dd className="font-mono text-xs">
                        {orgSlug}/{projectSlug}
                    </dd>
                </div>
            </dl>

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

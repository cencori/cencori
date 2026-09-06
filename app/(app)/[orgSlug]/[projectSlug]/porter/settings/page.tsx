"use client";

import { use } from "react";
import { hostOf, usePorter } from "../shared";
import { PorterHeader, NoPorter } from "../PorterHeader";

export default function PorterSettingsPage({
    params,
}: {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
    const { orgSlug, projectSlug } = use(params);
    const { data: porter, isLoading } = usePorter(orgSlug, projectSlug);

    if (isLoading) return <div className="mx-auto w-full max-w-3xl px-6 py-12 text-sm text-muted-foreground">…</div>;
    if (!porter) return <div className="mx-auto w-full max-w-3xl px-6 py-12"><NoPorter orgSlug={orgSlug} projectSlug={projectSlug} /></div>;

    const brand = { ...(porter.brand ?? {}), ...(porter.brand_overrides ?? {}) } as {
        color?: string;
        logo?: string;
    };
    const escalation = porter.actions?.find((action) => action.type === "email")?.to;

    return (
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
            <PorterHeader
                porter={porter}
                title="Settings"
                description="Read from your site when your Porter was created. Editing any of it keeps your version through the weekly refresh."
            />

            <dl className="divide-y divide-border border-y border-border">
                <div className="flex items-center justify-between gap-6 py-3">
                    <dt className="text-sm text-muted-foreground">Name</dt>
                    <dd className="text-sm font-medium">{porter.name}</dd>
                </div>
                <div className="flex items-center justify-between gap-6 py-3">
                    <dt className="text-sm text-muted-foreground">Site</dt>
                    <dd className="font-mono text-xs">{hostOf(porter)}</dd>
                </div>
                <div className="flex items-center justify-between gap-6 py-3">
                    <dt className="text-sm text-muted-foreground">Brand colour</dt>
                    <dd className="flex items-center gap-2 font-mono text-xs">
                        {brand.color ? (
                            <>
                                <span
                                    aria-hidden
                                    className="inline-block size-4 rounded border border-border"
                                    style={{ background: brand.color }}
                                />
                                {brand.color}
                            </>
                        ) : (
                            <span className="text-muted-foreground">none found</span>
                        )}
                    </dd>
                </div>
                <div className="flex items-center justify-between gap-6 py-3">
                    <dt className="text-sm text-muted-foreground">Logo</dt>
                    <dd className="flex min-w-0 items-center gap-3">
                        {brand.logo ? (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={brand.logo} alt="" className="size-8 rounded border border-border object-cover" />
                                <span className="truncate font-mono text-xs text-muted-foreground">{brand.logo}</span>
                            </>
                        ) : (
                            <span className="font-mono text-xs text-muted-foreground">none found</span>
                        )}
                    </dd>
                </div>
                <div className="flex items-center justify-between gap-6 py-3">
                    <dt className="text-sm text-muted-foreground">Escalates to</dt>
                    <dd className="font-mono text-xs">
                        {escalation ?? <span className="text-muted-foreground">no address on the page</span>}
                    </dd>
                </div>
                <div className="flex items-center justify-between gap-6 py-3">
                    <dt className="text-sm text-muted-foreground">Surface</dt>
                    <dd className="font-mono text-xs">{porter.surface}</dd>
                </div>
            </dl>

            <div className="mt-8">
                <p className="text-sm text-muted-foreground">What it has been told about you</p>
                <p className="mt-2 rounded border border-border bg-muted/40 p-4 text-sm leading-relaxed">
                    {porter.system_prompt ?? "Nothing yet — your site could not be read."}
                </p>
            </div>

            <p className="mt-8 text-sm text-muted-foreground">
                These are read-only for now. Editing lands with the settings work; Cencori&apos;s safety
                policy stays non-editable either way.
            </p>
        </div>
    );
}

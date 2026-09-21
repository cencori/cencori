"use client";

import { use } from "react";
import { EmbeddedAgentsDashboard } from "@/components/dashboard/embedded-agents/EmbeddedAgentsDashboard";

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

export default function EmbeddedAgentsPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);

    return (
        <div className="w-full max-w-[1180px] mx-auto px-6 py-8">
            <div className="mb-6">
                <h1 className="text-[2rem] tracking-[-0.055em] font-semibold">Embedded Agents</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                    The multi-tenant agent backend for your SaaS product — tenants, versions, knowledge, runs, approvals, and metering.
                </p>
            </div>
            <EmbeddedAgentsDashboard orgSlug={orgSlug} projectSlug={projectSlug} />
        </div>
    );
}

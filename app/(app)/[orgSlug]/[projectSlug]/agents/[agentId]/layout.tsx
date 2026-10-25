"use client";

import { use, type ReactNode } from "react";
import { AgentShell } from "@/components/agents/AgentShell";

export default function AgentLayout({ params, children }: { params: Promise<{ orgSlug: string; projectSlug: string; agentId: string }>; children: ReactNode }) {
    const { orgSlug, projectSlug, agentId } = use(params);
    return (
        <AgentShell orgSlug={orgSlug} projectSlug={projectSlug} agentId={decodeURIComponent(agentId)}>
            {children}
        </AgentShell>
    );
}

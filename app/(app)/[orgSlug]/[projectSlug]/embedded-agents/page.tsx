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
        <div className="h-full min-h-0 w-full overflow-hidden">
            <EmbeddedAgentsDashboard orgSlug={orgSlug} projectSlug={projectSlug} />
        </div>
    );
}

"use client";

import { use } from "react";
import { AgentsList, AgentsListSkeleton } from "@/components/agents/AgentsList";
import { useProjectIdBySlug } from "@/lib/hooks/useQueries";

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

export default function AgentsPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    const { data: projectId, isLoading } = useProjectIdBySlug(orgSlug, projectSlug);

    return (
        <main className="mx-auto w-full max-w-[1360px] px-0 pb-6 pt-0 sm:px-6 sm:pt-4 lg:px-8 lg:pt-6">
            {isLoading ? <AgentsListSkeleton /> : projectId ? <AgentsList projectId={projectId} /> : <p className="text-sm text-muted-foreground">Project not found.</p>}
        </main>
    );
}

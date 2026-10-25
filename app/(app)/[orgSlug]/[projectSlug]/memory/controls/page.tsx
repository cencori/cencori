'use client';

import { use } from 'react';
import { MemorySettingsPanel } from '@/components/memory/MemorySettingsPanel';
import { MemoryRoute } from '@/components/memory/MemoryRoute';

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

export default function MemoryControlsPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);

    return (
        <MemoryRoute
            orgSlug={orgSlug}
            projectSlug={projectSlug}
            title="Controls"
            description="A request only remembers when it carries a memory field. These settings apply when it does."
        >
            {(projectId) => <MemorySettingsPanel projectId={projectId} />}
        </MemoryRoute>
    );
}

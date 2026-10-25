'use client';

import { use } from 'react';
import { MemoryGraphCanvas } from '@/components/memory/MemoryGraphCanvas';
import { MemoryRoute } from '@/components/memory/MemoryRoute';

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

export default function MemoryGraphPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);

    return (
        <MemoryRoute
            orgSlug={orgSlug}
            projectSlug={projectSlug}
            fullWidth
        >
            {(projectId) => <MemoryGraphCanvas projectId={projectId} />}
        </MemoryRoute>
    );
}

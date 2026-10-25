'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { MemoryBrowser } from '@/components/memory/MemoryBrowser';
import { MemoryRoute } from '@/components/memory/MemoryRoute';

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

export default function MemoriesPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    // ?user= arrives from the overview's end-user drill-down.
    const initialUserId = useSearchParams().get('user') ?? '';

    return (
        <MemoryRoute
            orgSlug={orgSlug}
            projectSlug={projectSlug}
            title="Memories"
            description="Every fact stored for your end-users. Search, filter, and forget."
        >
            {(projectId) => <MemoryBrowser key={initialUserId} projectId={projectId} initialUserId={initialUserId} />}
        </MemoryRoute>
    );
}

'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { MemoryOverview } from '@/components/memory/MemoryOverview';
import { MemoryRoute, useMemoryBasePath } from '@/components/memory/MemoryRoute';

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

export default function MemoryPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    const router = useRouter();
    const basePath = useMemoryBasePath();

    return (
        <MemoryRoute
            orgSlug={orgSlug}
            projectSlug={projectSlug}
            title="Memory"
            description="What your app remembers about each end-user, and what gets recalled."
        >
            {(projectId) => (
                <MemoryOverview
                    projectId={projectId}
                    onViewMemories={(userId) => router.push(
                        userId ? `${basePath}/memories?user=${encodeURIComponent(userId)}` : `${basePath}/memories`,
                    )}
                />
            )}
        </MemoryRoute>
    );
}

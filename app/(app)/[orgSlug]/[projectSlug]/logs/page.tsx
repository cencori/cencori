'use client';

import { use, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getConsoleRoute } from '@/lib/console/routing';

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

// Logs moved under AI Gateway; keep old links and bookmarks working.
export default function LegacyLogsRedirect({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        const query = window.location.search;
        router.replace(
            getConsoleRoute(pathname)
                ? `/ai-gateway/logs${query}`
                : `/${orgSlug}/${projectSlug}/ai-gateway/logs${query}`,
        );
    }, [orgSlug, pathname, projectSlug, router]);

    return null;
}

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

// Logs moved to Observability → Request logs; keep old links and bookmarks working.
export default function LegacyLogsRedirect({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        const query = window.location.search;
        router.replace(
            getConsoleRoute(pathname)
                ? `/observability/request-logs${query}`
                : `/${orgSlug}/${projectSlug}/observability/request-logs${query}`,
        );
    }, [orgSlug, pathname, projectSlug, router]);

    return null;
}

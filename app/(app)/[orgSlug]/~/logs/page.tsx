'use client';

import { use, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getConsoleRoute } from '@/lib/console/routing';

interface PageProps {
    params: Promise<{ orgSlug: string }>;
}

// Logs moved under AI Gateway; keep old links and bookmarks working.
export default function LegacyOrgLogsRedirect({ params }: PageProps) {
    const { orgSlug } = use(params);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        router.replace(
            getConsoleRoute(pathname) ? '/organization/ai-gateway/logs' : `/${orgSlug}/~/ai-gateway/logs`,
        );
    }, [orgSlug, pathname, router]);

    return null;
}

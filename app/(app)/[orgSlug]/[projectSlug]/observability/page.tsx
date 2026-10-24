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

// Observability folded into the AI Gateway overview; keep old links working.
export default function LegacyObservabilityRedirect({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        router.replace(getConsoleRoute(pathname) ? '/ai-gateway' : `/${orgSlug}/${projectSlug}/ai-gateway`);
    }, [orgSlug, pathname, projectSlug, router]);

    return null;
}

'use client';

import { use, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getConsoleRoute } from '@/lib/console/routing';

interface PageProps {
    params: Promise<{ orgSlug: string }>;
}

// Observability folded into the AI Gateway overview; keep old links working.
export default function LegacyOrgObservabilityRedirect({ params }: PageProps) {
    const { orgSlug } = use(params);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        router.replace(getConsoleRoute(pathname) ? '/organization/ai-gateway' : `/${orgSlug}/~/ai-gateway`);
    }, [orgSlug, pathname, router]);

    return null;
}

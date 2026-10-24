'use client';

import { use, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getConsoleRoute } from '@/lib/console/routing';

interface PageProps {
    params: Promise<{ orgSlug: string }>;
}

// The old organization "AI Providers" page is gone; provider keys live in AI Gateway → BYOK.
export default function LegacyOrgProvidersRedirect({ params }: PageProps) {
    const { orgSlug } = use(params);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        router.replace(getConsoleRoute(pathname) ? '/ai-gateway/providers' : `/${orgSlug}/~/ai-gateway/providers`);
    }, [orgSlug, pathname, router]);

    return null;
}

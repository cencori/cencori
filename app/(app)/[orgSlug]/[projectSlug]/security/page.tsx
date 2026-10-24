'use client';

import { use, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getConsoleRoute } from '@/lib/console/routing';

interface PageProps {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}

// Security is now a single opt-in switch (PII protection) in project settings.
export default function LegacySecurityRedirect({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        router.replace(getConsoleRoute(pathname) ? '/settings' : `/${orgSlug}/${projectSlug}/settings`);
    }, [orgSlug, pathname, projectSlug, router]);

    return null;
}

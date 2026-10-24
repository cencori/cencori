'use client';

import { use, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getConsoleRoute } from '@/lib/console/routing';

interface PageProps {
    params: Promise<{ orgSlug: string }>;
}

// Security is now a single opt-in switch (PII protection) in project settings.
export default function LegacyOrgSecurityRedirect({ params }: PageProps) {
    const { orgSlug } = use(params);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        router.replace(getConsoleRoute(pathname) ? '/settings' : `/${orgSlug}/~/projects`);
    }, [orgSlug, pathname, router]);

    return null;
}

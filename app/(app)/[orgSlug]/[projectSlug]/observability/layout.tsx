'use client';

import { useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { getConsoleRoute } from '@/lib/console/routing';
import { useObservabilityAccess } from '@/lib/flags/flagswift';

// Observability is in beta behind a FlagSwift flag. Organizations without it
// land on the project overview instead.
export default function ObservabilityLayout({ children }: { children: React.ReactNode }) {
    const { enabled, loading } = useObservabilityAccess();
    const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
    const pathname = usePathname();
    const router = useRouter();
    const blocked = !loading && !enabled;

    useEffect(() => {
        if (!blocked) return;
        router.replace(getConsoleRoute(pathname) ? '/home' : `/${orgSlug}/${projectSlug}`);
    }, [blocked, orgSlug, pathname, projectSlug, router]);

    if (loading || blocked) return null;
    return <>{children}</>;
}

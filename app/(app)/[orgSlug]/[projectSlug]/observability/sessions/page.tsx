'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Sessions is now Traces; keep earlier links working.
export default function LegacySessionsRedirect() {
    const pathname = usePathname();
    const router = useRouter();
    useEffect(() => {
        router.replace(pathname.replace(/\/observability\/sessions\/?$/, '/observability/traces') + window.location.search);
    }, [pathname, router]);
    return null;
}

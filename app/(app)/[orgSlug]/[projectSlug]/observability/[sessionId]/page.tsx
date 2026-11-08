'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Sessions moved under /observability/sessions; keep earlier links working.
export default function LegacySessionRedirect() {
    const pathname = usePathname();
    const router = useRouter();
    useEffect(() => {
        router.replace(pathname.replace(/\/observability\/([^/]+)\/?$/, '/observability/sessions/$1'));
    }, [pathname, router]);
    return null;
}

'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Session links from before Observability had views; they're traces now.
export default function LegacySessionRedirect() {
    const pathname = usePathname();
    const router = useRouter();
    useEffect(() => {
        router.replace(pathname.replace(/\/observability\/([^/]+)\/?$/, '/observability/traces/$1'));
    }, [pathname, router]);
    return null;
}

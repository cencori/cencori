'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Observability opens on its first view, Sessions.
export default function ObservabilityIndex() {
    const pathname = usePathname();
    const router = useRouter();
    useEffect(() => {
        router.replace(`${pathname.replace(/\/$/, '')}/sessions`);
    }, [pathname, router]);
    return null;
}

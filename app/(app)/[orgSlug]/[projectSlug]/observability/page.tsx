'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Observability opens on Traces.
export default function ObservabilityIndex() {
    const pathname = usePathname();
    const router = useRouter();
    useEffect(() => {
        router.replace(`${pathname.replace(/\/$/, '')}/traces`);
    }, [pathname, router]);
    return null;
}

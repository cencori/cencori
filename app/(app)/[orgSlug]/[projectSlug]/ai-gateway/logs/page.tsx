'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Logs moved to Observability → Request logs. Old links keep working, with
// their filters carried over (time_range → range, api_key_id → key, search → q).
export default function LegacyGatewayLogsRedirect() {
    const pathname = usePathname();
    const router = useRouter();
    useEffect(() => {
        const old = new URLSearchParams(window.location.search);
        const next = new URLSearchParams();
        const map: Record<string, string> = { time_range: 'range', status: 'status', model: 'model', api_key_id: 'key', search: 'q' };
        for (const [from, to] of Object.entries(map)) {
            const value = old.get(from);
            if (value && value !== 'all') next.set(to, value);
        }
        const qs = next.toString();
        router.replace(`${pathname.replace(/\/ai-gateway\/logs\/?$/, '/observability/request-logs')}${qs ? `?${qs}` : ''}`);
    }, [pathname, router]);
    return null;
}

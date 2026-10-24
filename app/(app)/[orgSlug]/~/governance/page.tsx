'use client';

import { use, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getConsoleRoute } from '@/lib/console/routing';

interface PageProps {
    params: Promise<{ orgSlug: string }>;
}

// Governance is disabled; old links (and the MCP how_to_* tools) land on the audit log.
export default function LegacyGovernanceRedirect({ params }: PageProps) {
    const { orgSlug } = use(params);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        router.replace(getConsoleRoute(pathname) ? '/audit-log' : `/${orgSlug}/~/audit-log`);
    }, [orgSlug, pathname, router]);

    return null;
}

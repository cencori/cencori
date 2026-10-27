'use client';

import type { ReactNode } from 'react';
import { useCopilot } from '@/lib/contexts/CopilotContext';
import { Skeleton } from '@/components/ui/skeleton';

/** Header and width shared by Copilot's Usage and History pages. */
export function CopilotPageFrame({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: (context: { organizationId: string; chatHref: string | null }) => ReactNode;
}) {
    const copilot = useCopilot();
    const organizationId = copilot?.agent.organization?.id;

    return (
        <main className="mx-auto w-full max-w-[1180px] px-0 pb-6 pt-0 sm:px-6 sm:pt-4 lg:px-8 lg:pt-6">
            <header className="mb-6">
                <h1 className="text-base font-medium">{title}</h1>
                <p className="mt-0.5 max-w-[60ch] text-xs text-muted-foreground">{description}</p>
            </header>
            {organizationId
                ? children({ organizationId, chatHref: copilot?.fullPageHref ?? null })
                : <Skeleton className="h-[420px] w-full rounded-lg" />}
        </main>
    );
}

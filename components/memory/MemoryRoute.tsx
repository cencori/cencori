'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Brain } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectIdBySlug } from '@/lib/hooks/useQueries';

const PAGE_CLASS = 'mx-auto w-full px-4 pb-6 pt-2 sm:px-6 sm:pt-4 lg:px-8 lg:pt-6';

/** `/acme/app/memory/graph` → `/acme/app/memory`; console hosts give `/memory`. */
export function useMemoryBasePath(): string {
    const pathname = usePathname() ?? '';
    const index = pathname.indexOf('/memory');
    return index === -1 ? '/memory' : pathname.slice(0, index + '/memory'.length);
}

/**
 * The one loading block for Memory pages. Pages render this same block while
 * their own data loads, so resolving the project and then fetching the page
 * reads as a single load rather than two different skeletons in a row.
 */
export function MemoryPageSkeleton() {
    return <Skeleton className="h-[420px] w-full rounded-lg" />;
}

/**
 * The frame every Memory sub-page shares: resolves the project, then renders a
 * compact header (like Logs) and the page body.
 */
export function MemoryRoute({
    orgSlug,
    projectSlug,
    title,
    description,
    fullWidth = false,
    wide = false,
    children,
}: {
    orgSlug: string;
    projectSlug: string;
    /** Omitted on canvas pages (Graph), which use the whole page. */
    title?: string;
    description?: string;
    /** Edge to edge: no width cap and no padding, for canvas pages (Graph). */
    fullWidth?: boolean;
    /** The console home's 1360px width instead of the 1180px reading width. */
    wide?: boolean;
    children: (projectId: string) => ReactNode;
}) {
    const { data: projectId, isLoading } = useProjectIdBySlug(orgSlug, projectSlug);
    const pageClass = fullWidth
        ? 'flex min-h-0 w-full flex-1 flex-col overflow-hidden'
        : `${PAGE_CLASS} ${wide ? 'max-w-[1360px]' : 'max-w-[1180px]'}`;

    // The header is static, so it renders immediately; only the body waits.
    const header = title ? (
        <header className="mb-6">
            <h1 className="text-base font-medium">{title}</h1>
            {description && <p className="mt-0.5 max-w-[60ch] text-xs text-muted-foreground">{description}</p>}
        </header>
    ) : null;

    if (isLoading) {
        return (
            <main className={pageClass}>
                {header}
                <MemoryPageSkeleton />
            </main>
        );
    }

    if (!projectId) {
        return (
            <main className={pageClass}>
                <div className="flex flex-col items-center py-16 text-center">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
                        <Brain className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Project not found</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Unable to load memory for this project</p>
                </div>
            </main>
        );
    }

    return (
        <main className={pageClass}>
            {header}
            {children(projectId)}
        </main>
    );
}

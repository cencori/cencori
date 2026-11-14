'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Brain } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectIdBySlug } from '@/lib/hooks/useQueries';
import { useUpgrade } from '@/components/billing/UpgradeProvider';

const PAGE_CLASS = 'mx-auto w-full px-0 pb-6 pt-0 sm:px-6 sm:pt-4 lg:px-8 lg:pt-6';

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
 * Memory comes with Pro and Enterprise. On Free this stands in for the page,
 * or sits above it on the Memories list, where what was stored before can
 * still be read and forgotten.
 */
function MemoryUpgradeNotice({ compact = false }: { compact?: boolean }) {
    const upgrade = useUpgrade();
    const button = (
        <button
            type="button"
            onClick={() => upgrade.openUpgrade('memory')}
            onMouseEnter={upgrade.preloadUpgrade}
            className="h-7 shrink-0 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
            Upgrade to Pro
        </button>
    );
    if (compact) {
        return (
            <div className="mb-4 flex flex-col gap-2 rounded-md border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                    Memory is part of Pro. On Free nothing new is saved or recalled; you can still view and forget what&rsquo;s stored.
                </p>
                {button}
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
                <Brain className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Memory is part of Pro</p>
            <p className="mb-4 mt-0.5 max-w-[46ch] text-xs text-muted-foreground">
                Give your app long-term memory of each end-user. It&rsquo;s included in the Pro plan price, with no credits needed.
            </p>
            {button}
        </div>
    );
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
    showOnFree = false,
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
    /** Keep the page on Free, under an upgrade notice (the Memories list). */
    showOnFree?: boolean;
    children: (projectId: string) => ReactNode;
}) {
    const { data: projectId, isLoading } = useProjectIdBySlug(orgSlug, projectSlug);
    // True only once the org is known to be on Free, so a paid org never sees the notice flash.
    const needsUpgrade = useUpgrade().canUpgrade;
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

    if (needsUpgrade && !showOnFree) {
        return (
            <main className={fullWidth ? PAGE_CLASS : pageClass}>
                {header}
                <MemoryUpgradeNotice />
            </main>
        );
    }

    return (
        <main className={pageClass}>
            {header}
            {needsUpgrade && <MemoryUpgradeNotice compact />}
            {children(projectId)}
        </main>
    );
}

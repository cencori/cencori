import { cn } from '@/lib/utils';

const STATUS: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    paused: { label: 'Waiting', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    completed: { label: 'Ended', className: 'bg-muted text-muted-foreground border-border/60' },
    failed: { label: 'Failed', className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
    running: { label: 'Running', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
};

/** A session or turn status as a small pill. */
export function SessionStatusBadge({ status, label }: { status: string; label?: string }) {
    const s = STATUS[status] ?? { label: status, className: 'bg-muted text-muted-foreground border-border/60' };
    return (
        <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap', s.className)}>
            {label ?? s.label}
        </span>
    );
}

export function formatSessionTime(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function formatSessionCost(usd: number): string {
    if (!usd) return '$0';
    return usd < 0.01 ? `$${usd.toFixed(5)}` : `$${usd.toFixed(3)}`;
}

export function formatDuration(ms: number | null): string {
    if (ms === null) return '…';
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

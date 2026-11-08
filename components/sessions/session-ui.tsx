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

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Log-line time, as in the trace: NOV 08 16:14:36.24 */
export function formatSessionTime(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${MONTHS[d.getMonth()]} ${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(Math.floor(d.getMilliseconds() / 10))}`;
}

export function formatSessionCost(usd: number): string {
    if (!usd) return '$0';
    return usd < 0.01 ? `$${usd.toFixed(5)}` : `$${usd.toFixed(3)}`;
}

export function formatDuration(ms: number | null): string {
    if (ms === null) return '…';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
    if (ms < 3600_000) {
        const m = Math.floor(ms / 60_000);
        const s = Math.round((ms % 60_000) / 1000);
        return s ? `${m}m ${s}s` : `${m}m`;
    }
    if (ms < 86_400_000) {
        const h = Math.floor(ms / 3600_000);
        const m = Math.round((ms % 3600_000) / 60_000);
        return m ? `${h}h ${m}m` : `${h}h`;
    }
    const d = Math.floor(ms / 86_400_000);
    const h = Math.round((ms % 86_400_000) / 3600_000);
    return h ? `${d}d ${h}h` : `${d}d`;
}

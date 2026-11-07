'use client';

import { cn } from '@/lib/utils';

/** Console card chrome (header + body) holding a row of headline numbers. */
export function StatCard({
    title,
    detail,
    stats,
    note,
}: {
    title: string;
    detail: string;
    stats: Array<{ label: string; value: string; color: string; hint?: string; large?: boolean }>;
    note?: string;
}) {
    return (
        <article className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border/40 bg-muted/30">
            <header className="flex items-center justify-between gap-4 border-b border-border/40 px-5 py-3.5">
                <p className="text-sm font-medium tracking-[-0.01em] text-foreground">{title}</p>
                <span className="text-xs text-muted-foreground">{detail}</span>
            </header>
            <div className="grid grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, index) => (
                    <div
                        key={stat.label}
                        className={cn(
                            'min-w-0 px-5 py-5',
                            index % 2 === 1 && 'border-l border-border/40',
                            index >= 2 && 'border-t border-border/40 lg:border-t-0',
                            index === 2 && 'lg:border-l',
                        )}
                    >
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="size-2 shrink-0 rounded-[1px]" style={{ backgroundColor: stat.color }} />
                            {stat.label}
                        </p>
                        <p className={cn(
                            'mt-2 truncate font-mono font-medium tabular-nums tracking-tight text-foreground',
                            stat.large ? 'text-2xl' : 'text-xl',
                        )}>
                            {stat.value}
                        </p>
                        {stat.hint && <p className="mt-1 truncate text-[11px] text-muted-foreground">{stat.hint}</p>}
                    </div>
                ))}
            </div>
            {note && (
                <p className="border-t border-border/40 px-5 py-2.5 text-[11px] text-amber-600 dark:text-amber-400">{note}</p>
            )}
        </article>
    );
}

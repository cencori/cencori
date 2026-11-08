'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import {
    SOURCE_OPTIONS, STATUS_OPTIONS, TIME_RANGES, hasActiveFilters, readSessionFilters, writeSessionFilters, type SessionFilters,
} from '@/lib/sessions/filters';
import { cn } from '@/lib/utils';

export function FilterGroup({ title, count, open, onToggle, children }: { title: string; count?: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            >
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span>{title}</span>
                {count ? <span className="ml-auto rounded bg-muted px-1.5 text-[10px] font-medium text-foreground">{count}</span> : null}
            </button>
            {open && <div className="mb-1 ml-5 mt-0.5 space-y-0.5">{children}</div>}
        </div>
    );
}

export function FilterOption({ selected, label, onClick, radio }: { selected: boolean; label: string; onClick: () => void; radio?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] hover:bg-sidebar-accent', selected ? 'text-foreground' : 'text-muted-foreground')}
        >
            <span className={cn(
                'flex h-3.5 w-3.5 shrink-0 items-center justify-center border',
                radio ? 'rounded-full' : 'rounded-[3px]',
                selected ? 'border-foreground bg-foreground text-background' : 'border-border',
            )}>
                {selected && (radio ? <span className="h-1.5 w-1.5 rounded-full bg-background" /> : <Check className="h-2.5 w-2.5" strokeWidth={3} />)}
            </span>
            {label}
        </button>
    );
}

/**
 * The Sessions filters, in the sidebar under Observability (in the way
 * Vercel's Logs keeps its filters there), so the page itself stays full
 * screen. They write to the URL; the page reads them from it.
 */
export function SessionFiltersPanel() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const filters = readSessionFilters(searchParams);
    const [open, setOpen] = useState<Record<string, boolean>>({ timeline: true, status: true, source: true });

    const update = (next: SessionFilters) => {
        const qs = writeSessionFilters(next);
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };
    const toggle = (key: 'status' | 'source', value: string) => {
        const current = filters[key];
        update({ ...filters, [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
    };
    const flip = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

    return (
        <div className="mt-4">
            <div className="mb-1 flex items-center justify-between px-2">
                <span className="text-sm font-medium">Filters</span>
                {hasActiveFilters(filters) && (
                    <button type="button" onClick={() => update({ range: '7d', status: [], source: [], q: '' })} className="text-xs text-muted-foreground hover:text-foreground">
                        Reset
                    </button>
                )}
            </div>
            <FilterGroup title="Timeline" open={open.timeline} onToggle={() => flip('timeline')}>
                {TIME_RANGES.map((r) => (
                    <FilterOption key={r.value} radio selected={filters.range === r.value} label={r.label} onClick={() => update({ ...filters, range: r.value })} />
                ))}
            </FilterGroup>
            <FilterGroup title="Status" count={filters.status.length} open={open.status} onToggle={() => flip('status')}>
                {STATUS_OPTIONS.map((o) => (
                    <FilterOption key={o.value} selected={filters.status.includes(o.value)} label={o.label} onClick={() => toggle('status', o.value)} />
                ))}
            </FilterGroup>
            <FilterGroup title="Source" count={filters.source.length} open={open.source} onToggle={() => flip('source')}>
                {SOURCE_OPTIONS.map((o) => (
                    <FilterOption key={o.value} selected={filters.source.includes(o.value)} label={o.label} onClick={() => toggle('source', o.value)} />
                ))}
            </FilterGroup>
        </div>
    );
}

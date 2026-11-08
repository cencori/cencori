'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import Activity01Icon from '@hugeicons/core-free-icons/Activity01Icon';
import LeftToRightListDashIcon from '@hugeicons/core-free-icons/LeftToRightListDashIcon';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FilterGroup, FilterOption, SessionFiltersPanel } from '@/components/sessions/SessionFilters';
import { supabase } from '@/lib/supabaseClient';
import { useProjectIdBySlug } from '@/lib/hooks/useQueries';
import {
    DEFAULT_REQUEST_LOG_RANGE, REQUEST_LOG_RANGES, REQUEST_LOG_STATUSES,
    hasActiveRequestLogFilters, readRequestLogFilters, writeRequestLogFilters, type RequestLogFilters,
} from '@/lib/observability/request-log-filters';

/**
 * Observability's part of the sidebar, in the way Vercel's Logs works: a
 * picker for what to look at (Traces, Request logs), then that source's own
 * filters. Each source keeps its filters in the URL; switching source starts
 * from that source's defaults.
 */

type Source = 'traces' | 'request-logs';

const SOURCES: Array<{ value: Source; label: string; description: string; icon: IconSvgElement }> = [
    { value: 'traces', label: 'Traces', description: 'Agent sessions, turn by turn', icon: Activity01Icon },
    { value: 'request-logs', label: 'Request logs', description: 'Every model call through the gateway', icon: LeftToRightListDashIcon },
];

export function observabilitySource(pathname: string): Source | null {
    const match = pathname.match(/\/observability\/(traces|request-logs)(\/|$)/);
    return match ? (match[1] as Source) : null;
}

function SourcePicker({ base, current }: { base: string; current: Source }) {
    const active = SOURCES.find((s) => s.value === current)!;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-left text-sm hover:bg-muted/50"
                >
                    <HugeiconsIcon icon={active.icon} className="!h-4 !w-4 shrink-0" />
                    <span className="flex-1 truncate">{active.label}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-72 rounded-xl p-1">
                {SOURCES.map((s) => (
                    <DropdownMenuItem key={s.value} asChild className="cursor-pointer rounded-lg px-3 py-2">
                        <Link href={`${base}/${s.value}`} className="flex items-start gap-3">
                            <HugeiconsIcon icon={s.icon} className="mt-0.5 !h-4 !w-4 shrink-0" />
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm">{s.label}</span>
                                <span className="block text-xs text-muted-foreground">{s.description}</span>
                            </span>
                            {s.value === current && <Check className="mt-0.5 h-4 w-4 shrink-0" />}
                        </Link>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

interface ApiKeyOption { id: string; name: string; key_prefix: string }

function RequestLogFiltersPanel({ projectId }: { projectId?: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const filters = readRequestLogFilters(searchParams);
    const [open, setOpen] = useState<Record<string, boolean>>({ timeline: true, status: true, model: false, key: false });
    const flip = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

    // Open a group that has a filter set, so the choice is visible.
    useEffect(() => {
        setOpen((o) => ({ ...o, model: o.model || Boolean(filters.model), key: o.key || Boolean(filters.key) }));
    }, [filters.model, filters.key]);

    const update = (next: RequestLogFilters) => {
        const qs = writeRequestLogFilters(next);
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    const { data: models = [] } = useQuery<string[]>({
        queryKey: ['log-models', projectId, filters.range],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/logs/models?time_range=${filters.range}`);
            if (!res.ok) return [];
            return ((await res.json()).models ?? []) as string[];
        },
        enabled: Boolean(projectId),
        staleTime: 60_000,
    });
    const { data: keys = [] } = useQuery<ApiKeyOption[]>({
        queryKey: ['api-keys-filter', projectId],
        queryFn: async () => {
            const { data } = await supabase.from('api_keys').select('id, name, key_prefix').eq('project_id', projectId).is('revoked_at', null);
            return (data as ApiKeyOption[]) ?? [];
        },
        enabled: Boolean(projectId),
        staleTime: 60_000,
    });

    return (
        <div className="mt-4">
            <div className="mb-1 flex items-center justify-between px-2">
                <span className="text-sm font-medium">Filters</span>
                {hasActiveRequestLogFilters(filters) && (
                    <button type="button" onClick={() => update({ range: DEFAULT_REQUEST_LOG_RANGE, status: null, model: null, key: null, q: '' })} className="text-xs text-muted-foreground hover:text-foreground">
                        Reset
                    </button>
                )}
            </div>
            <FilterGroup title="Timeline" open={open.timeline} onToggle={() => flip('timeline')}>
                {REQUEST_LOG_RANGES.map((r) => (
                    <FilterOption key={r.value} radio selected={filters.range === r.value} label={r.label} onClick={() => update({ ...filters, range: r.value })} />
                ))}
            </FilterGroup>
            <FilterGroup title="Status" count={filters.status ? 1 : 0} open={open.status} onToggle={() => flip('status')}>
                <FilterOption radio selected={!filters.status} label="All statuses" onClick={() => update({ ...filters, status: null })} />
                {REQUEST_LOG_STATUSES.map((s) => (
                    <FilterOption key={s.value} radio selected={filters.status === s.value} label={s.label} onClick={() => update({ ...filters, status: s.value })} />
                ))}
            </FilterGroup>
            <FilterGroup title="Model" count={filters.model ? 1 : 0} open={open.model} onToggle={() => flip('model')}>
                <FilterOption radio selected={!filters.model} label="All models" onClick={() => update({ ...filters, model: null })} />
                {models.map((m) => (
                    <FilterOption key={m} radio selected={filters.model === m} label={m} onClick={() => update({ ...filters, model: m })} />
                ))}
                {models.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No models in this range.</p>}
            </FilterGroup>
            <FilterGroup title="API key" count={filters.key ? 1 : 0} open={open.key} onToggle={() => flip('key')}>
                <FilterOption radio selected={!filters.key} label="All keys" onClick={() => update({ ...filters, key: null })} />
                {keys.map((k) => (
                    <FilterOption key={k.id} radio selected={filters.key === k.id} label={`${k.name} (${k.key_prefix}…)`} onClick={() => update({ ...filters, key: k.id })} />
                ))}
            </FilterGroup>
        </div>
    );
}

export function ObservabilitySidebar({ base, orgSlug, projectSlug }: { base: string; orgSlug: string; projectSlug: string }) {
    const pathname = usePathname();
    const source = observabilitySource(pathname) ?? 'traces';
    const { data: projectId } = useProjectIdBySlug(orgSlug, projectSlug);
    // Filters belong to the lists; a single trace shows none.
    const onList = new RegExp(`/observability/${source}/?$`).test(pathname);

    return (
        <div className="px-2 pt-1">
            <SourcePicker base={base} current={source} />
            {onList && (source === 'traces' ? <SessionFiltersPanel /> : <RequestLogFiltersPanel projectId={projectId ?? undefined} />)}
        </div>
    );
}

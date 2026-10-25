'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface MemoryForgetSuggestionsProps {
    projectId: string;
    /** Filters rendered at the start of the toolbar (the Memories status picker). */
    filters?: ReactNode;
}

interface Suggestion {
    id: string;
    content: string;
    scopeKey: string;
    namespace: string | null;
    importance: number;
    accessCount: number;
    strength: number;
    idleDays: number;
}

interface SuggestionsResponse {
    suggestions: Suggestion[];
    bands: { strong: number; weak: number; stale: number };
    scanned: number;
    scanCapped: boolean;
    minIdleDays: number;
}

const IDLE_CHOICES = [
    { value: '30', label: 'Idle 30+ days' },
    { value: '60', label: 'Idle 60+ days' },
    { value: '90', label: 'Idle 90+ days' },
    { value: '180', label: 'Idle 180+ days' },
];

const HEAD_CLASS = 'h-8 text-[10px] font-medium uppercase tracking-wider text-muted-foreground';

function Band({ label, count, total, tone }: { label: string; count: number; total: number; tone: string }) {
    const share = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="border-b border-border/40 px-5 py-4 last:border-b-0 md:border-b-0 md:border-r last:md:border-r-0">
            <p className="text-[11px] leading-4 text-muted-foreground">{label}</p>
            <p className="mt-1.5 font-mono text-sm font-medium tabular-nums">{count}</p>
            <span className="mt-3 block h-1 w-full overflow-hidden rounded-full bg-muted">
                <span className={`block h-full rounded-full ${tone}`} style={{ width: `${share}%` }} />
            </span>
        </div>
    );
}

export function MemoryForgetSuggestions({ projectId, filters }: MemoryForgetSuggestionsProps) {
    const queryClient = useQueryClient();
    const [minIdleDays, setMinIdleDays] = useState('60');
    const [forgotten, setForgotten] = useState<Set<string>>(new Set());

    const { data, isLoading, error } = useQuery({
        queryKey: ['memoryForgetSuggestions', projectId, minIdleDays],
        queryFn: async (): Promise<SuggestionsResponse> => {
            const response = await fetch(
                `/api/projects/${projectId}/memory/forget-suggestions?minIdleDays=${minIdleDays}`
            );
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error || 'We could not evaluate memory strength.');
            }
            return response.json();
        },
        staleTime: 30_000,
    });

    const forget = useMutation({
        mutationFn: async (memoryId: string) => {
            const response = await fetch(`/api/projects/${projectId}/memory/entries/${memoryId}`, { method: 'DELETE' });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error || 'We could not forget that memory.');
            }
            return memoryId;
        },
        onSuccess: (memoryId) => {
            setForgotten(prev => new Set(prev).add(memoryId));
            queryClient.invalidateQueries({ queryKey: ['memoryOverview', projectId] });
            queryClient.invalidateQueries({ queryKey: ['memoryEntries', projectId] });
        },
    });

    const toolbar = (
        <div className="mb-4 flex flex-wrap items-center gap-3">
            {filters}
            <Select value={minIdleDays} onValueChange={setMinIdleDays}>
                <SelectTrigger className="h-7 w-[140px] text-xs shadow-none dark:shadow-xs">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {IDLE_CHOICES.map(choice => (
                        <SelectItem key={choice.value} value={choice.value} className="text-xs">
                            {choice.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {data && (
                <p className="ml-auto text-[11px] text-muted-foreground">
                    {data.suggestions.length === 0
                        ? `${data.scanned.toLocaleString()} memories evaluated`
                        : `${data.suggestions.length} candidates, weakest first`}
                    {data.scanCapped && ' · capped at the weakest 2,000'}
                </p>
            )}
        </div>
    );

    if (isLoading) {
        return (
            <div>
                {toolbar}
                <Skeleton className="mb-4 h-[88px] w-full rounded-lg" />
                <Skeleton className="h-64 w-full rounded-lg" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div>
                {toolbar}
                <p className="py-16 text-center text-xs text-muted-foreground">
                    {error instanceof Error ? error.message : 'Could not evaluate memory strength.'}
                </p>
            </div>
        );
    }

    const { bands, suggestions, scanned } = data;

    return (
        <div>
            {toolbar}

            <div className="mb-4 grid grid-cols-1 overflow-hidden rounded-lg border border-border/40 bg-muted/30 md:grid-cols-3">
                <Band label="Strong" count={bands.strong} total={scanned} tone="bg-foreground" />
                <Band label="Weak" count={bands.weak} total={scanned} tone="bg-amber-500" />
                <Band label="Stale" count={bands.stale} total={scanned} tone="bg-red-500" />
            </div>

            <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                {suggestions.length === 0 ? (
                    <div className="flex flex-col items-center px-5 py-14 text-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
                            <Sparkles className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">Nothing stale enough to suggest</p>
                        <p className="mt-0.5 max-w-[46ch] text-xs text-muted-foreground">
                            Lower the idle threshold to see weaker candidates.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-border/40 hover:bg-transparent">
                                    <TableHead className={cn(HEAD_CLASS, 'w-[180px] px-3')}>End user</TableHead>
                                    <TableHead className={HEAD_CLASS}>Memory</TableHead>
                                    <TableHead className={cn(HEAD_CLASS, 'w-[80px] text-right')}>Strength</TableHead>
                                    <TableHead className={cn(HEAD_CLASS, 'w-[70px] text-right')}>Idle</TableHead>
                                    <TableHead className={cn(HEAD_CLASS, 'w-[80px] text-right')}>Recalled</TableHead>
                                    <TableHead className={cn(HEAD_CLASS, 'w-[100px] pr-3')}><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {suggestions.map(suggestion => {
                                    const isGone = forgotten.has(suggestion.id);
                                    return (
                                        <TableRow
                                            key={suggestion.id}
                                            className={cn('border-b border-border/40 last:border-b-0', isGone ? 'opacity-40' : 'hover:bg-muted/50')}
                                        >
                                            <TableCell className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                                <p className="max-w-[170px] truncate">{suggestion.scopeKey}</p>
                                            </TableCell>
                                            <TableCell className="w-full max-w-0 py-2 text-xs">
                                                <p className={cn('truncate', isGone && 'line-through text-muted-foreground')} title={suggestion.content}>
                                                    {suggestion.content}
                                                </p>
                                            </TableCell>
                                            <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">{suggestion.strength.toFixed(2)}</TableCell>
                                            <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">{suggestion.idleDays}d</TableCell>
                                            <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">
                                                {suggestion.accessCount === 0 ? '—' : `${suggestion.accessCount}×`}
                                            </TableCell>
                                            <TableCell className="py-2 pr-3 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={isGone || forget.isPending}
                                                    onClick={() => forget.mutate(suggestion.id)}
                                                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-red-600"
                                                >
                                                    <Trash2 className="mr-1 h-3 w-3" />
                                                    {isGone ? 'Forgotten' : 'Forget'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            <p className="mt-3 max-w-[72ch] text-[11px] leading-4 text-muted-foreground">
                Strength weighs importance, recency of use, and how often a memory was recalled. Nothing is deleted automatically.
            </p>
        </div>
    );
}

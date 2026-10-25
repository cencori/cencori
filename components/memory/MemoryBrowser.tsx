'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, Trash2, X } from 'lucide-react';
import { HugeiconsIcon } from '@hugeicons/react';
import BrainIcon from '@hugeicons/core-free-icons/BrainIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MemoryUserPicker } from '@/components/memory/MemoryUserPicker';
import { MemoryForgetSuggestions } from '@/components/memory/MemoryForgetSuggestions';
import { cn } from '@/lib/utils';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MemoryBrowserProps {
    projectId: string;
    /** Opens the list already filtered to one end-user. */
    initialUserId?: string;
}

interface MemoryEntry {
    id: string;
    content: string;
    scope: string;
    scopeKey: string;
    namespace: string | null;
    importance: number;
    accessCount: number;
    status: string;
    createdAt: string | null;
    lastAccessedAt: string | null;
}

interface EntriesResponse {
    memories: MemoryEntry[];
    total: number;
    limit: number;
    offset: number;
}

const PAGE_SIZE = 25;
const HEAD_CLASS = 'h-8 text-[10px] font-medium uppercase tracking-wider text-muted-foreground';

// Same "02 Jan 26 17:41:47" timestamp as the Logs table.
function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2);
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${day} ${month} ${year} ${time}`;
}

function relativeDay(iso: string | null): string {
    if (!iso) return 'never';
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

export function MemoryBrowser({ projectId, initialUserId = '' }: MemoryBrowserProps) {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [status, setStatus] = useState('active');
    const [sort, setSort] = useState('recent');
    const [userId, setUserId] = useState(initialUserId);
    const [offset, setOffset] = useState(0);
    const [pendingDelete, setPendingDelete] = useState<MemoryEntry | null>(null);
    const [selected, setSelected] = useState<MemoryEntry | null>(null);

    const params = new URLSearchParams({
        status,
        sort,
        limit: String(PAGE_SIZE),
        offset: String(offset),
    });
    if (appliedSearch) params.set('q', appliedSearch);
    if (userId) params.set('userId', userId);

    const { data, isLoading, error } = useQuery({
        queryKey: ['memoryEntries', projectId, appliedSearch, status, sort, userId, offset],
        queryFn: async (): Promise<EntriesResponse> => {
            const response = await fetch(`/api/projects/${projectId}/memory/entries?${params.toString()}`);
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error || 'We could not load memories.');
            }
            return response.json();
        },
        enabled: status !== 'forget',
        staleTime: 15_000,
    });

    const forget = useMutation({
        mutationFn: async (memoryId: string) => {
            const response = await fetch(`/api/projects/${projectId}/memory/entries/${memoryId}`, { method: 'DELETE' });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error || 'We could not forget that memory.');
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['memoryEntries', projectId] });
            queryClient.invalidateQueries({ queryKey: ['memoryOverview', projectId] });
            queryClient.invalidateQueries({ queryKey: ['memoryForgetSuggestions', projectId] });
            setPendingDelete(null);
        },
    });

    const applySearch = () => {
        setOffset(0);
        setAppliedSearch(search.trim());
    };

    const total = data?.total ?? 0;
    const pageCount = data?.memories.length ?? 0;
    const showingTo = offset + pageCount;
    // The server returns a planner estimate for large result sets, so paging is
    // driven by whether the page came back full — never by the count.
    const hasNextPage = pageCount === PAGE_SIZE;
    const isEstimate = total >= 1000;

    const forgetMode = status === 'forget';
    const statusSelect = (
        <Select value={status} onValueChange={(value) => { setStatus(value); setOffset(0); }}>
            <SelectTrigger className="h-7 w-[170px] text-xs shadow-none dark:shadow-xs">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="active" className="text-xs">Active</SelectItem>
                <SelectItem value="superseded" className="text-xs">Superseded</SelectItem>
                <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                <SelectItem value="forget" className="text-xs">Suggested to forget</SelectItem>
            </SelectContent>
        </Select>
    );

    if (forgetMode) {
        return <MemoryForgetSuggestions projectId={projectId} filters={statusSelect} />;
    }

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
                {statusSelect}

                <Select value={sort} onValueChange={(value) => { setSort(value); setOffset(0); }}>
                    <SelectTrigger className="h-7 w-[140px] text-xs shadow-none dark:shadow-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="recent" className="text-xs">Newest first</SelectItem>
                        <SelectItem value="importance" className="text-xs">Most important</SelectItem>
                        <SelectItem value="recalled" className="text-xs">Most recalled</SelectItem>
                        <SelectItem value="stale" className="text-xs">Least used</SelectItem>
                    </SelectContent>
                </Select>

                <MemoryUserPicker
                    projectId={projectId}
                    value={userId}
                    onChange={(value) => { setUserId(value); setOffset(0); }}
                    source="memories"
                    placeholder="All end-users"
                    emptyLabel="No end-user has memories yet."
                    className="w-[180px]"
                />

                {userId && (
                    <Button
                        variant="ghost" size="sm"
                        onClick={() => { setUserId(''); setOffset(0); }}
                        className="h-7 px-2 text-xs text-muted-foreground"
                    >
                        <X className="mr-1 h-3 w-3" />
                        All users
                    </Button>
                )}

                <div className="relative ml-auto w-full sm:w-[260px]">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter') applySearch(); }}
                        onBlur={applySearch}
                        placeholder="Search memories…"
                        className="h-7 pl-8 text-xs shadow-none"
                    />
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                {isLoading ? (
                    <div className="divide-y divide-border/40">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <div key={index} className="grid grid-cols-4 items-center gap-4 px-4 py-3">
                                <Skeleton className="h-3 w-28" />
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="col-span-2 h-3 w-full" />
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <p className="px-5 py-16 text-center text-xs text-muted-foreground">
                        {error instanceof Error ? error.message : 'Could not load memories.'}
                    </p>
                ) : !data || data.memories.length === 0 ? (
                    !appliedSearch && !userId && status === 'active' ? (
                        <div className="flex flex-col items-center px-5 py-16 text-center">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-secondary">
                                <HugeiconsIcon icon={BrainIcon} className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium">No memories stored yet</p>
                            <p className="mt-0.5 max-w-[42ch] text-xs text-muted-foreground">
                                Add a memory field to any chat request and its facts land here.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center px-5 py-16 text-center">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-secondary">
                                <HugeiconsIcon icon={BrainIcon} className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium">{appliedSearch ? 'Nothing matches that' : 'No memories match these filters'}</p>
                            <p className="mt-0.5 max-w-[42ch] text-xs text-muted-foreground">
                                {appliedSearch
                                    ? 'Try a different phrase — this searches stored text, not meaning.'
                                    : 'Try another status or end-user.'}
                            </p>
                        </div>
                    )
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-border/40 hover:bg-transparent">
                                    <TableHead className={cn(HEAD_CLASS, 'w-[170px] px-3')}>Written</TableHead>
                                    <TableHead className={cn(HEAD_CLASS, 'w-[180px]')}>End user</TableHead>
                                    <TableHead className={HEAD_CLASS}>Memory</TableHead>
                                    <TableHead className={cn(HEAD_CLASS, 'hidden w-[120px] md:table-cell')}>Namespace</TableHead>
                                    <TableHead className={cn(HEAD_CLASS, 'w-[80px] text-right')}>Recalled</TableHead>
                                    <TableHead className={cn(HEAD_CLASS, 'w-[44px] pr-3')}><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.memories.map((memory) => (
                                    <TableRow
                                        key={memory.id}
                                        className="group cursor-pointer border-b border-border/40 transition-colors last:border-b-0 hover:bg-muted/50"
                                        onClick={() => setSelected(memory)}
                                    >
                                        <TableCell className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">{formatDate(memory.createdAt)}</TableCell>
                                        <TableCell className="py-2 font-mono text-xs text-muted-foreground">
                                            <p className="max-w-[170px] truncate">{memory.scopeKey}</p>
                                        </TableCell>
                                        <TableCell className="w-full max-w-0 py-2 text-xs">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <p className="truncate">{memory.content}</p>
                                                {memory.status !== 'active' && (
                                                    <span className="shrink-0 rounded-[4px] bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                        {memory.status}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden py-2 font-mono text-xs text-muted-foreground md:table-cell">
                                            <p className="max-w-[110px] truncate">{memory.namespace ?? '—'}</p>
                                        </TableCell>
                                        <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">
                                            {memory.accessCount === 0 ? '—' : `${memory.accessCount}×`}
                                        </TableCell>
                                        <TableCell className="py-2 pr-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label="Forget memory"
                                                onClick={(event) => { event.stopPropagation(); setPendingDelete(memory); }}
                                                className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {(offset > 0 || hasNextPage) && (
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="tabular-nums">
                        {offset + 1}–{showingTo} of {isEstimate ? '~' : ''}
                        {total.toLocaleString()}
                    </span>
                    <div className="flex gap-1">
                        <Button
                            variant="outline" size="icon"
                            className="h-7 w-7"
                            aria-label="Previous page"
                            disabled={offset === 0}
                            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="outline" size="icon"
                            className="h-7 w-7"
                            aria-label="Next page"
                            disabled={!hasNextPage}
                            onClick={() => setOffset(offset + PAGE_SIZE)}
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            <Dialog open={selected != null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
                <DialogContent className="top-[10%] flex max-h-[80vh] translate-y-0 flex-col overflow-hidden p-0 sm:max-w-[540px]">
                    {selected && (
                        <>
                            <DialogHeader className="shrink-0 border-b border-border/40 px-4 pb-3 pt-4">
                                <DialogTitle className="text-sm font-medium">Memory details</DialogTitle>
                                <DialogDescription className="text-[11px]">
                                    {formatDate(selected.createdAt)} • {selected.scopeKey}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
                                <div>
                                    <h3 className="mb-2 text-xs font-medium">Memory</h3>
                                    <p className="whitespace-pre-wrap rounded-md border border-border/40 p-3 text-xs leading-5">
                                        {selected.content}
                                    </p>
                                </div>
                                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    {[
                                        ['Status', selected.status],
                                        ['Namespace', selected.namespace ?? '—'],
                                        ['Importance', selected.importance.toFixed(2)],
                                        ['Recalled', selected.accessCount === 0 ? 'Never' : `${selected.accessCount}×`],
                                        ['Last recalled', relativeDay(selected.lastAccessedAt)],
                                        ['Scope', selected.scope],
                                    ].map(([label, value]) => (
                                        <div key={label} className="rounded-md border border-border/40 p-2.5">
                                            <dt className="text-[11px] text-muted-foreground">{label}</dt>
                                            <dd className="mt-1 truncate font-mono text-xs">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                                <p className="truncate font-mono text-[10px] text-muted-foreground">{selected.id}</p>
                            </div>

                            <DialogFooter className="shrink-0 border-t border-border/40 px-4 py-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs text-red-600 hover:text-red-600"
                                    onClick={() => { setPendingDelete(selected); setSelected(null); }}
                                >
                                    <Trash2 className="mr-1 h-3 w-3" />
                                    Forget
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={pendingDelete != null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm">Forget this memory?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs">
                            This is a real deletion, not a hidden flag — the row is removed and the model
                            can never recall it again. The audit log records that it happened; the content
                            does not survive. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {pendingDelete && (
                        <p className="rounded-md bg-muted px-3 py-2 text-xs leading-5 text-foreground/80">
                            {pendingDelete.content}
                        </p>
                    )}

                    {forget.error && (
                        <p className="text-xs text-red-600">
                            {forget.error instanceof Error ? forget.error.message : 'Could not forget that memory.'}
                        </p>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel className="h-8 text-xs">Keep it</AlertDialogCancel>
                        <AlertDialogAction
                            className="h-8 bg-red-600 text-xs hover:bg-red-600/90"
                            disabled={forget.isPending}
                            onClick={(event) => {
                                event.preventDefault();
                                if (pendingDelete) forget.mutate(pendingDelete.id);
                            }}
                        >
                            {forget.isPending ? 'Forgetting…' : 'Forget permanently'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

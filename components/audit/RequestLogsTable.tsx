'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from './StatusBadge';
import { RequestDetailModal } from './RequestDetailModal';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, FileText } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { onNavigationIntent } from '@/lib/navigation-intent';

interface RequestLog {
    id: string;
    created_at: string;
    status: 'success' | 'success_fallback' | 'filtered' | 'blocked_output' | 'error' | 'rate_limited';
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_usd: number;
    latency_ms: number;
    safety_score?: number;
    error_message?: string;
    filtered_reasons?: string[];
    request_preview: string;
    evaluation_status?: 'pending' | 'completed' | 'failed' | 'skipped';
    evaluation_score?: number | null;
}

interface RequestLogsTableProps {
    projectId?: string;
    environment: 'production' | 'test';
    filters: {
        status?: string;
        model?: string;
        time_range?: string;
        search?: string;
        api_key_id?: string;
    };
}

interface RequestLogsResponse {
    requests: RequestLog[];
    pagination: {
        total_pages: number;
    };
}

export function RequestLogsTable({ projectId, environment, filters }: RequestLogsTableProps) {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const queryKey = useMemo(() => [
        'request-logs',
        projectId,
        environment,
        page,
        filters,
    ] as const, [environment, filters, page, projectId]);

    const { data, isLoading, isFetching, error } = useQuery<RequestLogsResponse>({
        queryKey,
        queryFn: async ({ signal }) => {
            if (!projectId) return { requests: [], pagination: { total_pages: 1 } };

            const params = new URLSearchParams({
                page: page.toString(),
                per_page: '50',
                environment,
                ...(filters.status && { status: filters.status }),
                ...(filters.model && { model: filters.model }),
                ...(filters.time_range && { time_range: filters.time_range }),
                ...(filters.search && { search: filters.search }),
                ...(filters.api_key_id && { api_key_id: filters.api_key_id }),
            });

            const response = await fetch(`/api/projects/${projectId}/logs?${params}`, { signal });
            if (!response.ok) throw new Error('Failed to fetch logs');

            return response.json() as Promise<RequestLogsResponse>;
        },
        enabled: Boolean(projectId),
        staleTime: 60 * 1000,
        refetchOnMount: true,
        placeholderData: (previousData) => previousData,
    });

    const requests = data?.requests || [];
    const totalPages = data?.pagination.total_pages || 1;

    useEffect(() => {
        setPage(1);
    }, [filters]);

    useEffect(() => onNavigationIntent(() => {
        void queryClient.cancelQueries({ queryKey, exact: true });
    }), [queryClient, queryKey]);

    useEffect(() => {
        if (!error) return;
        console.error('Error fetching logs:', error);
        toast.error('Failed to load request logs');
    }, [error]);

    useEffect(() => {
        if (!projectId) return;
        const eventSource = new EventSource(`/api/projects/${projectId}/logs/stream`);
        const closeStreamForNavigation = onNavigationIntent(() => eventSource.close());

        eventSource.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'new_request') {
                    if (page === 1) {
                        queryClient.setQueryData<RequestLogsResponse>(queryKey, (previousData) => {
                            if (!previousData) return previousData;

                            return {
                                ...previousData,
                                requests: [
                                    data.request,
                                    ...previousData.requests.filter((request) => request.id !== data.request.id),
                                ].slice(0, 50),
                            };
                        });
                    }
                }
            } catch (error) {
                console.error('SSE parsing error:', error);
            }
        });

        eventSource.addEventListener('error', () => {
            eventSource.close();
        });

        return () => {
            closeStreamForNavigation();
            eventSource.close();
        };
    }, [page, projectId, queryClient, queryKey]);

    // Supabase-style timestamp: "02 Jan 26 17:41:47"
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleString('en-US', { month: 'short' });
        const year = date.getFullYear().toString().slice(-2);
        const time = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        return `${day} ${month} ${year} ${time}`;
    };

    const formatCost = (cost: number) => `$${cost.toFixed(6)}`;

    const handleRowClick = (requestId: string) => {
        setSelectedRequest(requestId);
        setIsModalOpen(true);
    };

    if (isLoading && requests.length === 0) {
        return (
            <div className="bg-card border border-border/40 rounded-md overflow-hidden">
                {/* Desktop skeleton */}
                <div className="hidden md:block">
                    {/* Header */}
                    <div className="border-b border-border/40 px-4 py-2">
                        <div className="grid grid-cols-7 gap-4">
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-3 w-10" />
                            <Skeleton className="h-3 w-14" />
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-3 w-12 ml-auto" />
                            <Skeleton className="h-3 w-10 ml-auto" />
                            <Skeleton className="h-3 w-12 ml-auto" />
                        </div>
                    </div>
                    {/* Rows */}
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="border-b border-border/40 px-4 py-3 last:border-b-0">
                            <div className="grid grid-cols-7 gap-4 items-center">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-3 w-full max-w-[200px]" />
                                <Skeleton className="h-3 w-12 ml-auto" />
                                <Skeleton className="h-3 w-16 ml-auto" />
                                <Skeleton className="h-3 w-14 ml-auto" />
                            </div>
                        </div>
                    ))}
                </div>
                {/* Mobile skeleton */}
                <div className="md:hidden divide-y divide-border/40">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="p-3">
                            <div className="flex items-start justify-between mb-1.5">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-3 w-14" />
                            </div>
                            <Skeleton className="h-3 w-full mb-1.5" />
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="text-center py-16 flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">No requests found</p>
                <p className="text-xs text-muted-foreground">
                    Try adjusting your filters or make some AI requests
                </p>
            </div>
        );
    }

    return (
        <>
            {/* Desktop Table */}
            <div className="bg-card border border-border/40 rounded-md overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b border-border/40">
                                <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 px-3 w-[180px]">Timestamp</TableHead>
                                <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 w-[60px]">Status</TableHead>
                                <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8">Path</TableHead>
                                <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right w-[80px]">Tokens</TableHead>
                                <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right w-[80px]">Score</TableHead>
                                <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right w-[80px]">Cost</TableHead>
                                <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right pr-3 w-[80px]">Latency</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requests.map((request) => (
                                <TableRow
                                    key={request.id}
                                    className="cursor-pointer hover:bg-muted/50 border-b border-border/40 last:border-b-0 transition-colors"
                                    onClick={() => handleRowClick(request.id)}
                                >
                                    <TableCell className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                                        {formatDate(request.created_at)}
                                    </TableCell>
                                    <TableCell className="py-2">
                                        <StatusBadge status={request.status} variant="code" />
                                    </TableCell>
                                    <TableCell className="py-2 font-mono text-xs text-muted-foreground">
                                        /ai/v1/chat/{request.model}
                                    </TableCell>
                                    <TableCell className="py-2 text-right text-xs font-mono text-muted-foreground">
                                        {request.total_tokens.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="py-2 text-right">
                                        {request.evaluation_status === 'completed' ? (
                                            <span className={`text-xs font-mono font-medium ${
                                                (request.evaluation_score || 0) >= 0.8 ? 'text-emerald-500' :
                                                (request.evaluation_score || 0) >= 0.5 ? 'text-amber-500' : 'text-red-500'
                                            }`}>
                                                {(request.evaluation_score || 0).toFixed(2)}
                                            </span>
                                        ) : request.evaluation_status === 'pending' ? (
                                            <Loader2 className="h-3 w-3 animate-spin ml-auto text-muted-foreground/40" />
                                        ) : (
                                            <span className="text-muted-foreground/20">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-2 text-right text-xs font-mono text-muted-foreground">
                                        {formatCost(request.cost_usd)}
                                    </TableCell>
                                    <TableCell className="py-2 text-right text-xs font-mono text-muted-foreground pr-3">
                                        {request.latency_ms}ms
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile view */}
                <div className="md:hidden divide-y divide-border/40">
                    {requests.map((request) => (
                        <div
                            key={request.id}
                            className="p-3 cursor-pointer hover:bg-secondary/30 active:bg-secondary/50 transition-colors"
                            onClick={() => handleRowClick(request.id)}
                        >
                            <div className="flex items-start justify-between mb-1.5">
                                <StatusBadge status={request.status} />
                                <span className="text-[10px] text-muted-foreground">
                                    {formatDate(request.created_at)}
                                </span>
                            </div>
                            <p className="text-xs truncate mb-1.5">
                                {request.request_preview || 'No preview'}
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span className="font-mono">{request.model}</span>
                                <div className="flex items-center gap-2">
                                    <span>{request.total_tokens.toLocaleString()} tok</span>
                                    <span className="font-mono">{formatCost(request.cost_usd)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between py-3">
                <p className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || isFetching}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || isFetching}
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Detail Modal */}
            {projectId && selectedRequest && (
                <RequestDetailModal
                    projectId={projectId}
                    requestId={selectedRequest}
                    open={isModalOpen}
                    onOpenChange={setIsModalOpen}
                />
            )}
        </>
    );
}

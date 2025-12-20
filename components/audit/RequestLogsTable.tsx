'use client';

import { useState, useEffect, useCallback } from 'react';
import { StatusBadge } from './StatusBadge';
import { RequestDetailModal } from './RequestDetailModal';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ChevronRight, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface RequestLog {
    id: string;
    created_at: string;
    status: 'success' | 'filtered' | 'blocked_output' | 'error' | 'rate_limited';
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
}

interface RequestLogsTableProps {
    projectId: string;
    environment: 'production' | 'test';
    filters: {
        status?: string;
        model?: string;
        time_range?: string;
        search?: string;
    };
}

export function RequestLogsTable({ projectId, environment, filters }: RequestLogsTableProps) {
    const [requests, setRequests] = useState<RequestLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: '50',
                environment,
                ...(filters.status && { status: filters.status }),
                ...(filters.model && { model: filters.model }),
                ...(filters.time_range && { time_range: filters.time_range }),
                ...(filters.search && { search: filters.search }),
            });

            const response = await fetch(`/api/projects/${projectId}/logs?${params}`);
            if (!response.ok) throw new Error('Failed to fetch logs');

            const data = await response.json();
            setRequests(data.requests);
            setTotalPages(data.pagination.total_pages);
        } catch (error) {
            console.error('Error fetching logs:', error);
            toast.error('Failed to load request logs');
        } finally {
            setLoading(false);
        }
    }, [projectId, environment, page, filters]);

    useEffect(() => {
        setPage(1);
    }, [filters]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        const eventSource = new EventSource(`/api/projects/${projectId}/logs/stream`);

        eventSource.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'new_request') {
                    if (page === 1) {
                        setRequests(prev => [data.request, ...prev].slice(0, 50));
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
            eventSource.close();
        };
    }, [projectId, page]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

        const day = date.getDate();
        const month = date.toLocaleString("en-US", { month: "short" });
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${month} ${day}, ${date.getFullYear()} ${time}`;
    };

    const formatCost = (cost: number) => `$${cost.toFixed(6)}`;

    const handleRowClick = (requestId: string) => {
        setSelectedRequest(requestId);
        setIsModalOpen(true);
    };

    if (loading && requests.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 px-4">Status</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Time</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Model</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Request</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right">Tokens</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right">Cost</TableHead>
                                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right pr-4">Latency</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requests.map((request) => (
                                <TableRow
                                    key={request.id}
                                    className="cursor-pointer hover:bg-secondary/30 border-b border-border/40 last:border-b-0 transition-colors"
                                    onClick={() => handleRowClick(request.id)}
                                >
                                    <TableCell className="py-2.5 px-4">
                                        <StatusBadge status={request.status} />
                                    </TableCell>
                                    <TableCell className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                        {formatDate(request.created_at)}
                                    </TableCell>
                                    <TableCell className="py-2.5 text-xs font-mono text-muted-foreground">
                                        {request.model}
                                    </TableCell>
                                    <TableCell className="py-2.5 max-w-[300px] truncate text-xs">
                                        {request.request_preview || 'No preview'}
                                    </TableCell>
                                    <TableCell className="py-2.5 text-right text-xs font-mono text-muted-foreground">
                                        {request.total_tokens.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="py-2.5 text-right text-xs font-mono text-muted-foreground">
                                        {formatCost(request.cost_usd)}
                                    </TableCell>
                                    <TableCell className="py-2.5 text-right text-xs font-mono text-muted-foreground pr-4">
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
                        disabled={page === 1 || loading}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedRequest && (
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

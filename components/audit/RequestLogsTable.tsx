'use client';

import { useState, useEffect, useCallback } from 'react';
import { StatusBadge } from './StatusBadge';
import { RequestDetailModal } from './RequestDetailModal';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TechnicalBorder } from '@/components/landing/TechnicalBorder';
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
    filters: {
        status?: string;
        model?: string;
        time_range?: string;
        search?: string;
    };
}

export function RequestLogsTable({ projectId, filters }: RequestLogsTableProps) {
    const [requests, setRequests] = useState<RequestLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Fetch logs
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: '50',
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
    }, [projectId, page, filters]);

    // Initial fetch and refetch on filter change
    useEffect(() => {
        setPage(1); // Reset to page 1 when filters change
    }, [filters]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Real-time updates via SSE
    useEffect(() => {
        const eventSource = new EventSource(`/api/projects/${projectId}/logs/stream`);

        eventSource.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'new_request') {
                    // Add new request to the beginning if on page 1
                    if (page === 1) {
                        setRequests(prev => [data.request, ...prev].slice(0, 50));
                        toast.success('New request logged', {
                            description: `Status: ${data.request.status}`,
                            duration: 3000,
                        });
                    }
                }
            } catch (error) {
                console.error('SSE parsing error:', error);
            }
        });

        eventSource.addEventListener('error', () => {
            console.error('SSE connection error');
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

        // Less than 1 minute
        if (diff < 60000) {
            return 'Just now';
        }
        // Less than 1 hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        }
        // Less than 1 day
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        }
        // More than 1 day
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatCost = (cost: number) => {
        return `$${cost.toFixed(6)}`;
    };

    const handleRowClick = (requestId: string) => {
        setSelectedRequest(requestId);
        setIsModalOpen(true);
    };

    if (loading && requests.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-lg font-medium text-muted-foreground">No requests found</p>
                <p className="text-sm text-muted-foreground mt-1">
                    Try adjusting your filters or make some AI requests
                </p>
            </div>
        );
    }

    return (
        <>
            <TechnicalBorder>
                {/* Desktop view */}
                <div className="hidden md:block overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Model</TableHead>
                                <TableHead>Request</TableHead>
                                <TableHead className="text-right">Tokens</TableHead>
                                <TableHead className="text-right">Cost</TableHead>
                                <TableHead className="text-right">Latency</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requests.map((request) => (
                                <TableRow
                                    key={request.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleRowClick(request.id)}
                                >
                                    <TableCell>
                                        <StatusBadge status={request.status} />
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                        {formatDate(request.created_at)}
                                    </TableCell>
                                    <TableCell className="text-sm font-mono">
                                        {request.model}
                                    </TableCell>
                                    <TableCell className="max-w-md truncate text-sm">
                                        {request.request_preview || 'No preview'}
                                    </TableCell>
                                    <TableCell className="text-right text-sm font-mono">
                                        {request.total_tokens.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right text-sm font-mono">
                                        {formatCost(request.cost_usd)}
                                    </TableCell>
                                    <TableCell className="text-right text-sm font-mono">
                                        {request.latency_ms}ms
                                    </TableCell>
                                    <TableCell>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile view */}
                <div className="md:hidden divide-y">
                    {requests.map((request) => (
                        <div
                            key={request.id}
                            className="p-4 cursor-pointer hover:bg-muted/50 active:bg-muted"
                            onClick={() => handleRowClick(request.id)}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <StatusBadge status={request.status} />
                                <span className="text-xs text-muted-foreground">
                                    {formatDate(request.created_at)}
                                </span>
                            </div>
                            <p className="text-sm truncate mb-2">
                                {request.request_preview || 'No preview'}
                            </p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="font-mono">{request.model}</span>
                                <div className="flex items-center gap-3">
                                    <span>{request.total_tokens.toLocaleString()} tokens</span>
                                    <span className="font-mono">{formatCost(request.cost_usd)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </TechnicalBorder>

            {/* Pagination */}
            <div className="flex items-center justify-between px-2 py-4">
                <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
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

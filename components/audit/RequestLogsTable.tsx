"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { RequestLog } from "@/lib/types/audit";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, MoreHorizontal, Eye } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RequestDetailModal } from "./RequestDetailModal";

interface RequestLogsTableProps {
    logs: RequestLog[];
    isLoading: boolean;
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
    };
    onPageChange: (page: number) => void;
    projectId: string;
}

export function RequestLogsTable({
    logs,
    isLoading,
    pagination,
    onPageChange,
    projectId,
}: RequestLogsTableProps) {
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div className="w-full space-y-4">
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Model</TableHead>
                                <TableHead>Preview</TableHead>
                                <TableHead>Tokens</TableHead>
                                <TableHead>Latency</TableHead>
                                <TableHead className="text-right">Cost</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><div className="h-6 w-20 animate-pulse rounded bg-muted" /></TableCell>
                                    <TableCell><div className="h-4 w-24 animate-pulse rounded bg-muted" /></TableCell>
                                    <TableCell><div className="h-4 w-32 animate-pulse rounded bg-muted" /></TableCell>
                                    <TableCell><div className="h-4 w-48 animate-pulse rounded bg-muted" /></TableCell>
                                    <TableCell><div className="h-4 w-16 animate-pulse rounded bg-muted" /></TableCell>
                                    <TableCell><div className="h-4 w-16 animate-pulse rounded bg-muted" /></TableCell>
                                    <TableCell><div className="h-4 w-16 animate-pulse rounded bg-muted ml-auto" /></TableCell>
                                    <TableCell><div className="h-8 w-8 animate-pulse rounded bg-muted" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[140px]">Status</TableHead>
                            <TableHead className="w-[140px]">Time</TableHead>
                            <TableHead className="w-[140px]">Model</TableHead>
                            <TableHead>Request Preview</TableHead>
                            <TableHead className="w-[100px]">Tokens</TableHead>
                            <TableHead className="w-[100px]">Latency</TableHead>
                            <TableHead className="w-[100px] text-right">Cost</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                    No requests found matching your filters.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow
                                    key={log.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => setSelectedRequestId(log.id)}
                                >
                                    <TableCell>
                                        <StatusBadge status={log.status} />
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        {log.model}
                                    </TableCell>
                                    <TableCell>
                                        <div className="max-w-[300px] truncate text-sm text-muted-foreground font-mono">
                                            {log.request_preview || <span className="italic opacity-50">Empty request</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {log.total_tokens.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {log.latency_ms}ms
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                        ${log.cost_usd.toFixed(6)}
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setSelectedRequestId(log.id)}>
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    View Details
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.perPage) + 1} to {Math.min(pagination.page * pagination.perPage, pagination.total)} of {pagination.total} requests
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <RequestDetailModal
                requestId={selectedRequestId}
                projectId={projectId}
                open={!!selectedRequestId}
                onOpenChange={(open) => !open && setSelectedRequestId(null)}
            />
        </div>
    );
}

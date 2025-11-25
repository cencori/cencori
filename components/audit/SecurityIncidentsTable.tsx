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
import { SeverityBadge } from "./SeverityBadge";
import { SecurityIncident } from "@/lib/types/audit";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, MoreHorizontal, ShieldCheck, ShieldAlert } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SecurityIncidentsTableProps {
    incidents: SecurityIncident[];
    isLoading: boolean;
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
    };
    onPageChange: (page: number) => void;
    onIncidentClick: (incidentId: string) => void;
}

export function SecurityIncidentsTable({
    incidents,
    isLoading,
    pagination,
    onPageChange,
    onIncidentClick,
}: SecurityIncidentsTableProps) {

    if (isLoading) {
        return (
            <div className="w-full space-y-4">
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Severity</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Risk Score</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><div className="h-6 w-20 animate-pulse rounded bg-muted" /></TableCell>
                                    <TableCell><div className="h-4 w-32 animate-pulse rounded bg-muted" /></TableCell>
                                    <TableCell><div className="h-4 w-24 animate-pulse rounded bg-muted" /></TableCell>
                                    <TableCell><div className="h-4 w-16 animate-pulse rounded bg-muted" /></TableCell>
                                    <TableCell><div className="h-6 w-24 animate-pulse rounded bg-muted" /></TableCell>
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
                            <TableHead className="w-[120px]">Severity</TableHead>
                            <TableHead className="w-[180px]">Incident Type</TableHead>
                            <TableHead className="w-[140px]">Time</TableHead>
                            <TableHead className="w-[120px]">Risk Score</TableHead>
                            <TableHead className="w-[140px]">Review Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {incidents.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No security incidents found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            incidents.map((incident) => (
                                <TableRow
                                    key={incident.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => onIncidentClick(incident.id)}
                                >
                                    <TableCell>
                                        <SeverityBadge severity={incident.severity} />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {incident.incident_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "h-2 w-16 rounded-full bg-muted overflow-hidden",
                                                incident.risk_score > 0.7 ? "bg-red-100" : "bg-yellow-100"
                                            )}>
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all",
                                                        incident.risk_score > 0.7 ? "bg-red-500" : "bg-yellow-500"
                                                    )}
                                                    style={{ width: `${incident.risk_score * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-mono">{incident.risk_score.toFixed(2)}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {incident.reviewed ? (
                                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                                                <ShieldCheck className="h-3 w-3" />
                                                Reviewed
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 gap-1">
                                                <ShieldAlert className="h-3 w-3" />
                                                Pending
                                            </Badge>
                                        )}
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
                                                <DropdownMenuItem onClick={() => onIncidentClick(incident.id)}>
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
                    Showing {((pagination.page - 1) * pagination.perPage) + 1} to {Math.min(pagination.page * pagination.perPage, pagination.total)} of {pagination.total} incidents
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
        </div>
    );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { SeverityBadge } from './SeverityBadge';
import { IncidentDetailModal } from './IncidentDetailModal';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronRight, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SecurityIncident {
    id: string;
    created_at: string;
    incident_type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    blocked_at: 'input' | 'output' | 'both';
    risk_score: number;
    confidence: number;
    reviewed: boolean;
    details: Record<string, unknown>;
}

interface SecurityIncidentsTableProps {
    projectId: string;
    environment: 'production' | 'test';
    filters: {
        severity?: string;
        type?: string;
        reviewed?: string;
        time_range?: string;
    };
}

export function SecurityIncidentsTable({ projectId, environment, filters }: SecurityIncidentsTableProps) {
    const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [summary, setSummary] = useState({ critical: 0, high: 0, medium: 0, low: 0 });

    const fetchIncidents = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: '50',
                environment,
                ...(filters.severity && { severity: filters.severity }),
                ...(filters.type && { type: filters.type }),
                ...(filters.reviewed && { reviewed: filters.reviewed }),
                ...(filters.time_range && { time_range: filters.time_range }),
            });

            const response = await fetch(`/api/projects/${projectId}/security/incidents?${params}`);
            if (!response.ok) throw new Error('Failed to fetch incidents');

            const data = await response.json();
            setIncidents(data.incidents);
            setSummary(data.summary);
            setTotalPages(data.pagination.total_pages);
        } catch (error) {
            console.error('Error fetching incidents:', error);
            toast.error('Failed to load security incidents');
        } finally {
            setLoading(false);
        }
    }, [projectId, environment, page, filters]);

    useEffect(() => {
        setPage(1);
    }, [filters]);

    useEffect(() => {
        fetchIncidents();
    }, [fetchIncidents]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatIncidentType = (type: string) => {
        return type.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    const handleRowClick = (incidentId: string) => {
        setSelectedIncident(incidentId);
        setIsModalOpen(true);
    };

    const handleIncidentReviewed = () => {
        // Refresh the list after marking as reviewed
        fetchIncidents();
    };

    if (loading && incidents.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Critical</p>
                    <p className="text-2xl font-bold text-red-600">{summary.critical}</p>
                </div>
                <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground mb-1">High</p>
                    <p className="text-2xl font-bold text-yellow-600">{summary.high}</p>
                </div>
                <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Medium</p>
                    <p className="text-2xl font-bold text-yellow-600">{summary.medium}</p>
                </div>
                <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Low</p>
                    <p className="text-2xl font-bold text-zinc-600 dark:text-zinc-400">{summary.low}</p>
                </div>
            </div>

            {incidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
                    <p className="text-lg font-medium text-muted-foreground">No incidents found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {filters.severity !== 'all' || filters.type !== 'all'
                            ? 'Try adjusting your filters'
                            : 'Your project is secure! 🎉'
                        }
                    </p>
                </div>
            ) : (
                <>
                    <div className="rounded-md border">
                        {/* Desktop view */}
                        <div className="hidden md:block overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Severity</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Blocked At</TableHead>
                                        <TableHead className="text-right">Risk Score</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {incidents.map((incident) => (
                                        <TableRow
                                            key={incident.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => handleRowClick(incident.id)}
                                        >
                                            <TableCell>
                                                <SeverityBadge severity={incident.severity} />
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {formatIncidentType(incident.incident_type)}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                {formatDate(incident.created_at)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                    {incident.blocked_at}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-sm font-mono">
                                                {(incident.risk_score * 100).toFixed(0)}%
                                            </TableCell>
                                            <TableCell>
                                                {incident.reviewed ? (
                                                    <Badge variant="outline" className="text-green-600 border-green-500/20">
                                                        <CheckCircle className="mr-1 h-3 w-3" />
                                                        Reviewed
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-muted-foreground">
                                                        Pending
                                                    </Badge>
                                                )}
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
                            {incidents.map((incident) => (
                                <div
                                    key={incident.id}
                                    className="p-4 cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleRowClick(incident.id)}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <SeverityBadge severity={incident.severity} />
                                            {incident.reviewed && (
                                                <Badge variant="outline" className="text-xs text-green-600">
                                                    ✓
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDate(incident.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium mb-2">
                                        {formatIncidentType(incident.incident_type)}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{incident.blocked_at} block</span>
                                        <span className="font-mono">Risk: {(incident.risk_score * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

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
                </>
            )}

            {/* Detail Modal */}
            {selectedIncident && (
                <IncidentDetailModal
                    projectId={projectId}
                    incidentId={selectedIncident}
                    open={isModalOpen}
                    onOpenChange={setIsModalOpen}
                    onReviewed={handleIncidentReviewed}
                />
            )}
        </>
    );
}

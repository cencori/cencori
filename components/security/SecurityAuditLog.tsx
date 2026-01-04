'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Key, Shield, Settings, Webhook, AlertTriangle, UserX as X } from 'lucide-react';

interface SecurityAuditLogProps {
    projectId: string;
}

interface AuditLogEntry {
    id: string;
    event_type: string;
    actor_email: string | null;
    actor_ip: string | null;
    details: Record<string, unknown>;
    created_at: string;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
    // Admin events
    settings_updated: <Settings className="h-3 w-3" />,
    api_key_created: <Key className="h-3 w-3" />,
    api_key_deleted: <Key className="h-3 w-3" />,
    api_key_rotated: <Key className="h-3 w-3" />,
    webhook_created: <Webhook className="h-3 w-3" />,
    webhook_deleted: <Webhook className="h-3 w-3" />,
    incident_reviewed: <Shield className="h-3 w-3" />,
    ip_blocked: <AlertTriangle className="h-3 w-3" />,
    rate_limit_exceeded: <AlertTriangle className="h-3 w-3" />,
    auth_failed: <X className="h-3 w-3" />,
    // Security incidents
    content_filter: <Shield className="h-3 w-3" />,
    intent_analysis: <Shield className="h-3 w-3" />,
    jailbreak: <AlertTriangle className="h-3 w-3" />,
    prompt_injection: <AlertTriangle className="h-3 w-3" />,
    output_leakage: <AlertTriangle className="h-3 w-3" />,
    pii_input: <Shield className="h-3 w-3" />,
    pii_output: <Shield className="h-3 w-3" />,
    // Data rule incidents
    data_rule_block: <Shield className="h-3 w-3" />,
    data_rule_mask: <Shield className="h-3 w-3" />,
    data_rule_redact: <Shield className="h-3 w-3" />,
};

const EVENT_LABELS: Record<string, string> = {
    // Admin events
    settings_updated: 'Settings Updated',
    api_key_created: 'API Key Created',
    api_key_deleted: 'API Key Deleted',
    api_key_rotated: 'API Key Rotated',
    webhook_created: 'Webhook Created',
    webhook_deleted: 'Webhook Deleted',
    incident_reviewed: 'Incident Reviewed',
    ip_blocked: 'IP Blocked',
    rate_limit_exceeded: 'Rate Limit Exceeded',
    auth_failed: 'Auth Failed',
    // Security incidents
    content_filter: 'Content Blocked',
    intent_analysis: 'Intent Blocked',
    jailbreak: 'Jailbreak Attempt',
    prompt_injection: 'Prompt Injection',
    output_leakage: 'Output Leakage',
    pii_input: 'PII Detected (Input)',
    pii_output: 'PII Detected (Output)',
    // Data rule incidents
    data_rule_block: 'Data Rule Blocked',
    data_rule_mask: 'Data Masked',
    data_rule_redact: 'Data Redacted',
};

function useAuditLog(projectId: string, page: number, eventType: string, timeRange: string) {
    return useQuery({
        queryKey: ['securityAuditLog', projectId, page, eventType, timeRange],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: '20',
                time_range: timeRange,
                ...(eventType !== 'all' && { event_type: eventType }),
            });
            const response = await fetch(`/api/projects/${projectId}/security/audit?${params}`);
            if (!response.ok) throw new Error('Failed to fetch audit log');
            return response.json();
        },
        staleTime: 30 * 1000,
    });
}

function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function SecurityAuditLog({ projectId }: SecurityAuditLogProps) {
    const [page, setPage] = useState(1);
    const [eventType, setEventType] = useState('all');
    const [timeRange, setTimeRange] = useState('7d');

    const { data, isLoading } = useAuditLog(projectId, page, eventType, timeRange);
    const logs = data?.logs || [];
    const pagination = data?.pagination || { page: 1, total_pages: 1, total: 0 };

    if (isLoading && logs.length === 0) {
        return (
            <div className="space-y-4">
                <div className="flex gap-3">
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-7 w-24" />
                </div>
                <div className="rounded-lg border border-border/40 overflow-hidden">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="border-b border-border/40 p-3 last:border-b-0">
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-4 w-4" />
                                <Skeleton className="h-3 w-32" />
                                <Skeleton className="h-3 w-40 flex-1" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger className="w-[160px] h-7 text-xs">
                        <SelectValue placeholder="All events" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-xs">All events</SelectItem>
                        <SelectItem value="content_filter" className="text-xs">Content Blocked</SelectItem>
                        <SelectItem value="intent_analysis" className="text-xs">Intent Blocked</SelectItem>
                        <SelectItem value="jailbreak" className="text-xs">Jailbreak Attempt</SelectItem>
                        <SelectItem value="prompt_injection" className="text-xs">Prompt Injection</SelectItem>
                        <SelectItem value="output_leakage" className="text-xs">Output Leakage</SelectItem>
                        <SelectItem value="pii_input" className="text-xs">PII (Input)</SelectItem>
                        <SelectItem value="pii_output" className="text-xs">PII (Output)</SelectItem>
                        <SelectItem value="settings_updated" className="text-xs">Settings Updated</SelectItem>
                        <SelectItem value="api_key_created" className="text-xs">API Key Created</SelectItem>
                        <SelectItem value="api_key_deleted" className="text-xs">API Key Deleted</SelectItem>
                        <SelectItem value="webhook_created" className="text-xs">Webhook Created</SelectItem>
                        <SelectItem value="incident_reviewed" className="text-xs">Incident Reviewed</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[100px] h-7 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1h" className="text-xs">1 Hour</SelectItem>
                        <SelectItem value="24h" className="text-xs">24 Hours</SelectItem>
                        <SelectItem value="7d" className="text-xs">7 Days</SelectItem>
                        <SelectItem value="30d" className="text-xs">30 Days</SelectItem>
                        <SelectItem value="all" className="text-xs">All Time</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Log Table */}
            {logs.length === 0 ? (
                <div className="text-center py-16 rounded-lg border border-border/40 bg-card">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mx-auto mb-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium mb-1">No audit logs found</p>
                    <p className="text-xs text-muted-foreground">
                        Security events will appear here when they occur
                    </p>
                </div>
            ) : (
                <>
                    <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-b border-border/40">
                                        <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 px-4 w-10" />
                                        <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Event</TableHead>
                                        <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Actor</TableHead>
                                        <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Details</TableHead>
                                        <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right pr-4">Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log: AuditLogEntry) => (
                                        <TableRow key={log.id} className="border-b border-border/40 last:border-b-0">
                                            <TableCell className="py-2.5 px-4">
                                                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                                                    {EVENT_ICONS[log.event_type] || <Shield className="h-3 w-3" />}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2.5">
                                                <Badge variant="outline" className="text-[10px] h-5">
                                                    {EVENT_LABELS[log.event_type] || log.event_type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-2.5 text-xs text-muted-foreground">
                                                {log.actor_email || 'System'}
                                                {log.actor_ip && (
                                                    <span className="text-[10px] ml-2 font-mono text-muted-foreground/60">
                                                        {log.actor_ip}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                                                {Object.keys(log.details).length > 0
                                                    ? JSON.stringify(log.details).slice(0, 60) + '...'
                                                    : '-'
                                                }
                                            </TableCell>
                                            <TableCell className="py-2.5 text-right text-xs text-muted-foreground pr-4 whitespace-nowrap">
                                                {formatDate(log.created_at)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile View */}
                        <div className="md:hidden divide-y divide-border/40">
                            {logs.map((log: AuditLogEntry) => (
                                <div key={log.id} className="p-3">
                                    <div className="flex items-start justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                                                {EVENT_ICONS[log.event_type] || <Shield className="h-2.5 w-2.5" />}
                                            </div>
                                            <Badge variant="outline" className="text-[9px] h-4">
                                                {EVENT_LABELS[log.event_type] || log.event_type}
                                            </Badge>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">
                                            {formatDate(log.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {log.actor_email || 'System'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                            {pagination.total} events • Page {pagination.page} of {pagination.total_pages}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setPage(p => p + 1)}
                                disabled={page >= pagination.total_pages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

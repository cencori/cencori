'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RequestDetail {
    id: string;
    created_at: string;
    status: 'success' | 'filtered' | 'blocked_output' | 'error' | 'rate_limited';
    model: string;
    request_payload: Record<string, unknown> | null;
    response_payload: string | Record<string, unknown> | null;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_usd: number;
    latency_ms: number;
    safety_score?: number;
    error_message?: string;
    filtered_reasons?: string[];
    api_key?: {
        name: string;
        environment: string;
    };
    security_incidents?: Array<{
        id: string;
        incident_type: string;
        severity: string;
        risk_score: number;
    }>;
}

interface RequestDetailModalProps {
    projectId: string;
    requestId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RequestDetailModal({ projectId, requestId, open, onOpenChange }: RequestDetailModalProps) {
    const [request, setRequest] = useState<RequestDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    useEffect(() => {
        if (open && requestId) {
            fetchRequestDetail();
        }
    }, [open, requestId]);

    const fetchRequestDetail = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/projects/${projectId}/logs/${requestId}`);
            if (!response.ok) throw new Error('Failed to fetch request details');

            const data = await response.json();
            setRequest(data);
        } catch (error) {
            console.error('Error fetching request details:', error);
            toast.error('Failed to load request details');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            toast.success('Copied to clipboard');
            setTimeout(() => setCopiedField(null), 2000);
        } catch (error) {
            toast.error('Failed to copy');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    if (loading || !request) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Loading Request Details</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Request Details
                        <StatusBadge status={request.status} />
                    </DialogTitle>
                    <DialogDescription>
                        {formatDate(request.created_at)} • {request.model}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Security Checks */}
                    <div>
                        <h3 className="text-sm font-semibold mb-3">Security Checks</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-lg border p-3">
                                <p className="text-xs text-muted-foreground mb-1">Overall Safety</p>
                                <p className="text-2xl font-bold">
                                    {request.safety_score ? (request.safety_score * 100).toFixed(0) + '%' : 'N/A'}
                                </p>
                            </div>
                            <div className="rounded-lg border p-3">
                                <p className="text-xs text-muted-foreground mb-1">Security Incidents</p>
                                <p className="text-2xl font-bold">
                                    {request.security_incidents?.length || 0}
                                </p>
                            </div>
                            <div className="rounded-lg border p-3">
                                <p className="text-xs text-muted-foreground mb-1">Filtered Reasons</p>
                                <p className="text-2xl font-bold">
                                    {request.filtered_reasons?.length || 0}
                                </p>
                            </div>
                        </div>

                        {request.filtered_reasons && request.filtered_reasons.length > 0 && (
                            <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                                <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-500 mb-2">
                                    Blocked Reasons:
                                </p>
                                <ul className="text-xs text-yellow-600/80 dark:text-yellow-500/80 space-y-1">
                                    {request.filtered_reasons.map((reason, i) => (
                                        <li key={i}>• {reason}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Request & Response */}
                    <Tabs defaultValue="request" className="w-full">
                        <TabsList>
                            <TabsTrigger value="request">Request</TabsTrigger>
                            <TabsTrigger value="response">Response</TabsTrigger>
                            <TabsTrigger value="metrics">Metrics</TabsTrigger>
                        </TabsList>

                        <TabsContent value="request" className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">Request Payload</h4>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopy(JSON.stringify(request.request_payload, null, 2), 'request')}
                                >
                                    {copiedField === 'request' ? (
                                        <Check className="h-4 w-4" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                                {JSON.stringify(request.request_payload, null, 2)}
                            </pre>
                        </TabsContent>

                        <TabsContent value="response" className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">Response Payload</h4>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopy(
                                        typeof request.response_payload === 'string'
                                            ? request.response_payload
                                            : JSON.stringify(request.response_payload, null, 2),
                                        'response'
                                    )}
                                >
                                    {copiedField === 'response' ? (
                                        <Check className="h-4 w-4" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            {request.response_payload ? (
                                <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto whitespace-pre-wrap">
                                    {typeof request.response_payload === 'string'
                                        ? request.response_payload
                                        : JSON.stringify(request.response_payload, null, 2)}
                                </pre>
                            ) : (
                                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                                    No response data (request was filtered)
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="metrics" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Prompt Tokens</p>
                                    <p className="text-lg font-bold font-mono">{request.prompt_tokens.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Completion Tokens</p>
                                    <p className="text-lg font-bold font-mono">{request.completion_tokens.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Total Tokens</p>
                                    <p className="text-lg font-bold font-mono">{request.total_tokens.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Cost</p>
                                    <p className="text-lg font-bold font-mono">${request.cost_usd.toFixed(6)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Latency</p>
                                    <p className="text-lg font-bold font-mono">{request.latency_ms}ms</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Environment</p>
                                    <p className="text-lg font-bold">{request.api_key?.environment || 'Unknown'}</p>
                                </div>
                            </div>

                            {request.error_message && (
                                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                                    <p className="text-xs font-semibold text-red-600 dark:text-red-500 mb-2">
                                        Error Message:
                                    </p>
                                    <p className="text-sm text-red-600/80 dark:text-red-500/80">
                                        {request.error_message}
                                    </p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>

                    {/* Security Incidents */}
                    {request.security_incidents && request.security_incidents.length > 0 && (
                        <>
                            <Separator />
                            <div>
                                <h3 className="text-sm font-semibold mb-3">Related Security Incidents</h3>
                                <div className="space-y-2">
                                    {request.security_incidents.map((incident) => (
                                        <div
                                            key={incident.id}
                                            className="flex items-center justify-between rounded-lg border p-3"
                                        >
                                            <div>
                                                <p className="text-sm font-medium">{incident.incident_type}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Risk Score: {(incident.risk_score * 100).toFixed(0)}%
                                                </p>
                                            </div>
                                            <span className={cn(
                                                'text-xs font-semibold px-2 py-1 rounded',
                                                incident.severity === 'critical' && 'bg-red-500/10 text-red-600',
                                                incident.severity === 'high' && 'bg-yellow-500/10 text-yellow-600',
                                                incident.severity === 'medium' && 'bg-blue-500/10 text-blue-600',
                                                incident.severity === 'low' && 'bg-zinc-500/10 text-zinc-600'
                                            )}>
                                                {incident.severity.toUpperCase()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

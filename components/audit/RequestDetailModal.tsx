'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

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

/**
 * Logged payloads are not one shape: chat logs `messages[]` with string content,
 * vision logs content parts, the Responses API logs `input`, and some rows have
 * nothing at all. Show the prompt when we can find it, the raw payload when we
 * cannot, and an empty state when there is genuinely nothing.
 */
function contentToText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map(part => {
                if (typeof part === 'string') return part;
                const p = part as { text?: unknown; type?: unknown };
                if (typeof p?.text === 'string') return p.text;
                return p?.type ? `[${String(p.type)}]` : '';
            })
            .filter(Boolean)
            .join('\n');
    }
    return '';
}

export function extractRequestPrompt(
    payload: Record<string, unknown> | null | undefined
): { text: string; raw: string } {
    if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
        return { text: '', raw: '' };
    }

    const messages = (payload as { messages?: unknown }).messages;
    if (Array.isArray(messages) && messages.length > 0) {
        const userMessages = messages.filter(
            (m): m is { role: string; content: unknown } =>
                !!m && typeof m === 'object' && (m as { role?: unknown }).role === 'user'
        );
        const source = userMessages.length > 0 ? userMessages : messages;
        const text = contentToText((source[source.length - 1] as { content?: unknown })?.content);
        if (text) return { text, raw: JSON.stringify(payload, null, 2) };
    }

    // Responses API style: a bare string or a list of input items.
    const input = (payload as { input?: unknown }).input;
    const inputText = typeof input === 'string' ? input : contentToText(input);
    if (inputText) return { text: inputText, raw: JSON.stringify(payload, null, 2) };

    return { text: '', raw: JSON.stringify(payload, null, 2) };
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
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date.toLocaleString("en-US", { month: "short" });
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `${month} ${day}, ${date.getFullYear()} ${time}`;
    };

    if (loading || !request) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[540px] p-0 top-[10%] translate-y-0">
                    {/* Skeleton Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-border/40">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-28 bg-secondary/80 rounded animate-pulse" />
                            <div className="h-5 w-16 bg-emerald-500/20 rounded animate-pulse" />
                        </div>
                        <div className="h-3 w-48 bg-secondary/60 rounded animate-pulse mt-1.5" />
                    </div>

                    {/* Skeleton Content */}
                    <div className="px-4 py-3 space-y-4">
                        {/* Security Section */}
                        <div>
                            <div className="h-3 w-24 bg-secondary/60 rounded animate-pulse mb-2" />
                            <div className="rounded-md border border-border/40 p-3">
                                <div className="flex items-center justify-between">
                                    <div className="h-3 w-20 bg-secondary/60 rounded animate-pulse" />
                                    <div className="h-4 w-10 bg-secondary/80 rounded animate-pulse" />
                                </div>
                            </div>
                        </div>

                        {/* Tabs Skeleton */}
                        <div className="flex gap-4 border-b border-border/40 pb-2">
                            <div className="h-3 w-14 bg-secondary/80 rounded animate-pulse" />
                            <div className="h-3 w-16 bg-secondary/60 rounded animate-pulse" />
                            <div className="h-3 w-14 bg-secondary/60 rounded animate-pulse" />
                        </div>

                        {/* Metrics Grid Skeleton */}
                        <div className="grid grid-cols-3 gap-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="rounded-md border border-border/40 p-2.5">
                                    <div className="h-2.5 w-16 bg-secondary/60 rounded animate-pulse mb-1.5" />
                                    <div className="h-4 w-10 bg-secondary/80 rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[540px] p-0 top-[10%] translate-y-0 max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <DialogHeader className="px-4 pt-4 pb-3 border-b border-border/40 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-sm font-medium">
                        Request Details
                        <StatusBadge status={request.status} />
                    </DialogTitle>
                    <p className="text-[11px] text-muted-foreground">
                        {formatDate(request.created_at)} • {request.model}
                    </p>
                </DialogHeader>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                    {/* Security Summary */}
                    <div>
                        <h3 className="text-xs font-medium mb-2">Security Checks</h3>
                        <div className="rounded-md border border-border/40 p-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">Overall Safety</span>
                                <span className="text-sm font-medium font-mono">
                                    {request.safety_score ? (request.safety_score * 100).toFixed(0) + '%' : 'N/A'}
                                </span>
                            </div>
                        </div>

                        {request.filtered_reasons && request.filtered_reasons.length > 0 && (
                            <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
                                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mb-1">
                                    Blocked Reasons:
                                </p>
                                <ul className="text-[11px] text-amber-600/80 dark:text-amber-400/80 space-y-0.5">
                                    {request.filtered_reasons.map((reason, i) => (
                                        <li key={i}>• {reason}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Tabs */}
                    <Tabs defaultValue="request" className="w-full">
                        <TabsList className="h-10 w-full justify-start gap-4 rounded-none border-b border-border/40 bg-transparent p-0">
                            <TabsTrigger
                                value="request"
                                className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-4 text-xs font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >
                                Request
                            </TabsTrigger>
                            <TabsTrigger
                                value="response"
                                className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-4 text-xs font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >
                                Response
                            </TabsTrigger>
                            <TabsTrigger
                                value="metrics"
                                className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-4 text-xs font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >
                                Metrics
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="request" className="mt-3 space-y-2">
                            {(() => {
                                const { text: promptText, raw: rawPayload } = extractRequestPrompt(request.request_payload);
                                const copyText = promptText || rawPayload || '';

                                return (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-medium">Request Payload</h4>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                disabled={!copyText}
                                                onClick={() => handleCopy(copyText, 'request')}
                                            >
                                                {copiedField === 'request' ? (
                                                    <Check className="h-3 w-3 text-emerald-500" />
                                                ) : (
                                                    <Copy className="h-3 w-3" />
                                                )}
                                            </Button>
                                        </div>
                                        {copyText ? (
                                            <pre className="rounded-md bg-secondary/50 p-3 text-[11px] font-mono whitespace-pre-wrap break-words max-h-[280px] overflow-y-auto">
                                                {copyText}
                                            </pre>
                                        ) : (
                                            <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                                                No request payload was recorded for this request.
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </TabsContent>



                        <TabsContent value="response" className="mt-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-medium">Response Payload</h4>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleCopy(
                                        typeof request.response_payload === 'string'
                                            ? request.response_payload
                                            : JSON.stringify(request.response_payload, null, 2),
                                        'response'
                                    )}
                                >
                                    {copiedField === 'response' ? (
                                        <Check className="h-3 w-3 text-emerald-500" />
                                    ) : (
                                        <Copy className="h-3 w-3" />
                                    )}
                                </Button>
                            </div>
                            {request.response_payload ? (
                                <pre className="rounded-md bg-secondary/50 p-3 text-[11px] font-mono whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                                    {typeof request.response_payload === 'string'
                                        ? request.response_payload
                                        : JSON.stringify(request.response_payload, null, 2)}
                                </pre>
                            ) : (
                                <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                                    {request.status === 'filtered' || request.status === 'blocked_output'
                                        ? 'No response data — the request was blocked before a reply was returned.'
                                        : request.status === 'error'
                                            ? 'No response data — the request failed.'
                                            : 'No response payload was recorded for this request.'}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>

                    {/* Security Incidents */}
                    {request.security_incidents && request.security_incidents.length > 0 && (
                        <div>
                            <h3 className="text-xs font-medium mb-2">Security Incidents</h3>
                            <div className="space-y-1.5">
                                {request.security_incidents.map((incident) => (
                                    <div
                                        key={incident.id}
                                        className="flex items-center justify-between rounded-md border border-border/40 p-2.5"
                                    >
                                        <div>
                                            <p className="text-xs font-medium">{incident.incident_type}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                Risk: {(incident.risk_score * 100).toFixed(0)}%
                                            </p>
                                        </div>
                                        <span className={cn(
                                            'text-[10px] font-medium px-1.5 py-0.5 rounded',
                                            incident.severity === 'critical' && 'bg-red-500/10 text-red-500',
                                            incident.severity === 'high' && 'bg-amber-500/10 text-amber-500',
                                            incident.severity === 'medium' && 'bg-blue-500/10 text-blue-500',
                                            incident.severity === 'low' && 'bg-zinc-500/10 text-zinc-400'
                                        )}>
                                            {incident.severity.toUpperCase()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

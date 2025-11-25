"use client";

import { useEffect, useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "./StatusBadge";
import { RequestLogDetail } from "@/lib/types/audit";
import { format } from "date-fns";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CodeBlock } from "@/components/ai-elements/code-block";

interface RequestDetailModalProps {
    requestId: string | null;
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RequestDetailModal({
    requestId,
    projectId,
    open,
    onOpenChange,
}: RequestDetailModalProps) {
    const [data, setData] = useState<RequestLogDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [copiedId, setCopiedId] = useState(false);

    useEffect(() => {
        if (open && requestId) {
            setLoading(true);
            fetch(`/api/projects/${projectId}/logs/${requestId}`)
                .then((res) => res.json())
                .then((data) => {
                    setData(data);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error("Failed to fetch request details", err);
                    setLoading(false);
                });
        } else {
            setData(null);
        }
    }, [open, requestId, projectId]);

    const copyId = () => {
        if (requestId) {
            navigator.clipboard.writeText(requestId);
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[800px] sm:w-[540px] md:w-[800px] overflow-y-auto">
                <SheetHeader className="mb-6">
                    <div className="flex items-center justify-between">
                        <SheetTitle>Request Details</SheetTitle>
                        {data && <StatusBadge status={data.status} />}
                    </div>
                    <SheetDescription className="flex items-center gap-2">
                        ID: <span className="font-mono text-xs">{requestId}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={copyId}
                        >
                            {copiedId ? (
                                <Check className="h-3 w-3 text-green-500" />
                            ) : (
                                <Copy className="h-3 w-3" />
                            )}
                        </Button>
                    </SheetDescription>
                </SheetHeader>

                {loading ? (
                    <div className="space-y-4">
                        <div className="h-24 animate-pulse rounded-lg bg-muted" />
                        <div className="h-64 animate-pulse rounded-lg bg-muted" />
                    </div>
                ) : data ? (
                    <div className="space-y-6">
                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Time</div>
                                <div className="text-sm font-medium">
                                    {format(new Date(data.created_at), "MMM d, HH:mm:ss")}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Model</div>
                                <div className="text-sm font-medium font-mono">{data.model}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Latency</div>
                                <div className="text-sm font-medium">{data.latency_ms}ms</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Cost</div>
                                <div className="text-sm font-medium font-mono">
                                    ${data.cost_usd.toFixed(6)}
                                </div>
                            </div>
                        </div>

                        {/* Security Info */}
                        {(data.status === 'filtered' || data.status === 'blocked_output') && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                                <h4 className="mb-2 text-sm font-semibold text-red-900 dark:text-red-200">
                                    Security Violation Detected
                                </h4>
                                <div className="space-y-2 text-sm text-red-800 dark:text-red-300">
                                    {data.filtered_reasons?.map((reason, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                            {reason}
                                        </div>
                                    ))}
                                    {data.error_message && (
                                        <div className="mt-2 font-mono text-xs opacity-90">
                                            {data.error_message}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <Tabs defaultValue="request" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="request">Request</TabsTrigger>
                                <TabsTrigger value="response">Response</TabsTrigger>
                            </TabsList>

                            <TabsContent value="request" className="mt-4">
                                <div className="space-y-4">
                                    <div className="rounded-md border bg-muted/50 p-4">
                                        <div className="mb-2 text-xs font-medium text-muted-foreground">
                                            System / User Messages
                                        </div>
                                        <ScrollArea className="h-[400px]">
                                            {data.request_payload.messages?.map((msg, i) => (
                                                <div key={i} className="mb-4 last:mb-0">
                                                    <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">
                                                        {msg.role}
                                                    </div>
                                                    <div className="whitespace-pre-wrap text-sm font-mono">
                                                        {msg.content}
                                                    </div>
                                                </div>
                                            ))}
                                        </ScrollArea>
                                    </div>

                                    <div className="rounded-md border bg-muted/30 p-3">
                                        <div className="mb-2 text-xs font-medium text-muted-foreground">
                                            Raw JSON
                                        </div>
                                        <CodeBlock
                                            language="json"
                                            code={JSON.stringify(data.request_payload, null, 2)}
                                        />
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="response" className="mt-4">
                                <div className="space-y-4">
                                    {data.response_payload?.text ? (
                                        <div className="rounded-md border bg-muted/50 p-4">
                                            <div className="mb-2 text-xs font-medium text-muted-foreground">
                                                Generated Content
                                            </div>
                                            <ScrollArea className="h-[400px]">
                                                <div className="whitespace-pre-wrap text-sm font-mono">
                                                    {data.response_payload.text}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    ) : (
                                        <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
                                            No response content available
                                        </div>
                                    )}

                                    {data.response_payload && (
                                        <div className="rounded-md border bg-muted/30 p-3">
                                            <div className="mb-2 text-xs font-medium text-muted-foreground">
                                                Raw JSON
                                            </div>
                                            <CodeBlock
                                                language="json"
                                                code={JSON.stringify(data.response_payload, null, 2)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        Failed to load details
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

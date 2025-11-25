"use client";

import { useEffect, useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet";
import { SeverityBadge } from "./SeverityBadge";
import { SecurityIncident } from "@/lib/types/audit";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ShieldCheck, AlertTriangle } from "lucide-react";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { toast } from "sonner";

interface SecurityIncidentModalProps {
    incidentId: string | null;
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate?: () => void;
}

export function SecurityIncidentModal({
    incidentId,
    projectId,
    open,
    onOpenChange,
    onUpdate,
}: SecurityIncidentModalProps) {
    const [data, setData] = useState<SecurityIncident | null>(null);
    const [loading, setLoading] = useState(false);
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open && incidentId) {
            setLoading(true);
            fetch(`/api/projects/${projectId}/security/incidents/${incidentId}`)
                .then((res) => res.json())
                .then((data) => {
                    setData(data);
                    setNotes(data.notes || "");
                    setLoading(false);
                })
                .catch((err) => {
                    console.error("Failed to fetch incident details", err);
                    setLoading(false);
                });
        } else {
            setData(null);
            setNotes("");
        }
    }, [open, incidentId, projectId]);

    const handleMarkReviewed = async () => {
        if (!incidentId) return;

        setSubmitting(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/security/incidents/${incidentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reviewed: true,
                    notes: notes
                })
            });

            if (!res.ok) throw new Error('Failed to update');

            toast.success("Incident marked as reviewed");
            onUpdate?.();
            onOpenChange(false);
        } catch (error) {
            toast.error("Failed to update incident");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[800px] sm:w-[540px] md:w-[800px] overflow-y-auto">
                <SheetHeader className="mb-6">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="flex items-center gap-2">
                            Security Incident
                            {data?.reviewed && (
                                <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <CheckCircle2 className="h-3 w-3" /> Reviewed
                                </span>
                            )}
                        </SheetTitle>
                        {data && <SeverityBadge severity={data.severity} />}
                    </div>
                    <SheetDescription>
                        ID: <span className="font-mono text-xs">{incidentId}</span>
                    </SheetDescription>
                </SheetHeader>

                {loading ? (
                    <div className="space-y-4">
                        <div className="h-24 animate-pulse rounded-lg bg-muted" />
                        <div className="h-64 animate-pulse rounded-lg bg-muted" />
                    </div>
                ) : data ? (
                    <div className="space-y-6">
                        {/* Incident Summary */}
                        <div className="rounded-lg border bg-card p-4">
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">Type</div>
                                    <div className="text-sm font-medium capitalize">
                                        {data.incident_type.replace(/_/g, ' ')}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">Blocked At</div>
                                    <div className="text-sm font-medium uppercase">{data.blocked_at}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">Risk Score</div>
                                    <div className="text-sm font-medium font-mono">{data.risk_score.toFixed(2)}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">Time</div>
                                    <div className="text-sm font-medium">
                                        {format(new Date(data.created_at), "MMM d, HH:mm:ss")}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detected Patterns */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                                Detected Patterns
                            </h3>
                            <div className="rounded-md border bg-muted/30 p-4">
                                <ul className="list-disc pl-4 space-y-1 text-sm">
                                    {data.details.patterns_detected?.map((pattern, i) => (
                                        <li key={i} className="text-foreground/90">{pattern}</li>
                                    ))}
                                    {data.details.reasons?.map((reason, i) => (
                                        <li key={i} className="text-foreground/90">{reason}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Blocked Content Preview */}
                        {data.details.blocked_content && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold">Blocked Content</h3>
                                <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/10">
                                    <div className="text-xs font-medium text-red-800 dark:text-red-300 mb-2">
                                        Type: {data.details.blocked_content.type}
                                    </div>
                                    <div className="space-y-1">
                                        {data.details.blocked_content.examples.map((ex, i) => (
                                            <div key={i} className="font-mono text-sm text-red-900 dark:text-red-200 bg-red-100/50 dark:bg-red-900/30 px-2 py-1 rounded">
                                                {ex}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Review Section */}
                        <div className="space-y-3 pt-4 border-t">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" />
                                Security Review
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="notes">Analyst Notes</Label>
                                    <Textarea
                                        id="notes"
                                        placeholder="Add investigation notes..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="min-h-[100px]"
                                    />
                                </div>
                                {!data.reviewed && (
                                    <Button
                                        className="w-full"
                                        onClick={handleMarkReviewed}
                                        disabled={submitting}
                                    >
                                        {submitting ? "Updating..." : "Mark as Reviewed & Safe"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        Failed to load incident
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SeverityBadge } from './SeverityBadge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

interface IncidentDetail {
    id: string;
    created_at: string;
    incident_type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    blocked_at: 'input' | 'output' | 'both';
    risk_score: number;
    confidence: number;
    reviewed: boolean;
    review_notes?: string;
    reviewed_at?: string;
    details: {
        patterns_detected?: string[];
        blocked_content?: {
            type: string;
            examples: string[];
        };
        reasons?: string[];
    };
    related_request?: {
        id: string;
        created_at: string;
        status: string;
        model: string;
        preview: string;
    };
}

interface IncidentDetailModalProps {
    projectId: string;
    incidentId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onReviewed?: () => void;
}

export function IncidentDetailModal({ projectId, incidentId, open, onOpenChange, onReviewed }: IncidentDetailModalProps) {
    const [incident, setIncident] = useState<IncidentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [reviewNotes, setReviewNotes] = useState('');
    const [reviewing, setReviewing] = useState(false);

    useEffect(() => {
        if (open && incidentId) {
            fetchIncidentDetail();
        }
    }, [open, incidentId]);

    const fetchIncidentDetail = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/projects/${projectId}/security/incidents/${incidentId}`);
            if (!response.ok) throw new Error('Failed to fetch incident details');

            const data = await response.json();
            setIncident(data);
            setReviewNotes(data.review_notes || '');
        } catch (error) {
            console.error('Error fetching incident details:', error);
            toast.error('Failed to load incident details');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkReviewed = async () => {
        if (!incident) return;

        setReviewing(true);
        try {
            const response = await fetch(`/api/projects/${projectId}/security/incidents/${incidentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reviewed: !incident.reviewed,
                    review_notes: reviewNotes,
                }),
            });

            if (!response.ok) throw new Error('Failed to update incident');

            toast.success(incident.reviewed ? 'Marked as unreviewed' : 'Marked as reviewed');
            onReviewed?.();
            fetchIncidentDetail();
        } catch (error) {
            console.error('Error updating incident:', error);
            toast.error('Failed to update incident');
        } finally {
            setReviewing(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const formatIncidentType = (type: string) => {
        return type.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    if (loading || !incident) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Loading Incident Details</DialogTitle>
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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Security Incident
                        <SeverityBadge severity={incident.severity} />
                    </DialogTitle>
                    <DialogDescription>
                        {formatDate(incident.created_at)} • {formatIncidentType(incident.incident_type)}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
                            <p className="text-2xl font-bold font-mono">
                                {(incident.risk_score * 100).toFixed(0)}%
                            </p>
                        </div>
                        <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                            <p className="text-2xl font-bold font-mono">
                                {(incident.confidence * 100).toFixed(0)}%
                            </p>
                        </div>
                        <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground mb-1">Blocked At</p>
                            <p className="text-lg font-bold capitalize">{incident.blocked_at}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground mb-1">Status</p>
                            <p className="text-lg font-bold">
                                {incident.reviewed ? (
                                    <span className="text-green-600">✓ Reviewed</span>
                                ) : (
                                    <span className="text-yellow-600">⋯ Pending</span>
                                )}
                            </p>
                        </div>
                    </div>

                    <Separator />

                    {/* Detected Patterns */}
                    {incident.details.patterns_detected && incident.details.patterns_detected.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold mb-3">Detected Patterns</h3>
                            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                                <ul className="space-y-2">
                                    {incident.details.patterns_detected.map((pattern, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                            <span>{pattern}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Blocked Content */}
                    {incident.details.blocked_content && (
                        <div>
                            <h3 className="text-sm font-semibold mb-3">Blocked Content</h3>
                            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                                <p className="text-sm font-medium text-red-600 dark:text-red-500 mb-2">
                                    Type: {incident.details.blocked_content.type}
                                </p>
                                <p className="text-xs text-muted-foreground mb-2">Examples:</p>
                                <ul className="space-y-1">
                                    {incident.details.blocked_content.examples.slice(0, 5).map((example, i) => (
                                        <li key={i} className="text-sm font-mono text-red-600/80 dark:text-red-500/80">
                                            • {example}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Reasons */}
                    {incident.details.reasons && incident.details.reasons.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold mb-3">Detection Reasons</h3>
                            <ul className="space-y-1 text-sm text-muted-foreground">
                                {incident.details.reasons.map((reason, i) => (
                                    <li key={i}>• {reason}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Related Request */}
                    {incident.related_request && (
                        <>
                            <Separator />
                            <div>
                                <h3 className="text-sm font-semibold mb-3">Related AI Request</h3>
                                <div className="rounded-lg border p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-medium">
                                                {incident.related_request.model}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDate(incident.related_request.created_at)}
                                            </p>
                                        </div>
                                        <Badge variant="outline">
                                            {incident.related_request.status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                        {incident.related_request.preview || 'No preview available'}
                                    </p>
                                    <Link
                                        href={`?view=logs&request=${incident.related_request.id}`}
                                        className="inline-flex items-center text-sm text-blue-600 hover:underline"
                                    >
                                        View Full Request
                                        <ExternalLink className="ml-1 h-3 w-3" />
                                    </Link>
                                </div>
                            </div>
                        </>
                    )}

                    <Separator />

                    {/* Review Section */}
                    <div>
                        <h3 className="text-sm font-semibold mb-3">Review</h3>
                        <div className="space-y-3">
                            <Textarea
                                placeholder="Add review notes (optional)..."
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                                rows={3}
                                className="text-sm"
                            />
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">
                                    {incident.reviewed && incident.reviewed_at && (
                                        <span>Reviewed on {formatDate(incident.reviewed_at)}</span>
                                    )}
                                </div>
                                <Button
                                    onClick={handleMarkReviewed}
                                    disabled={reviewing}
                                    variant={incident.reviewed ? 'outline' : 'default'}
                                >
                                    {reviewing ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Updating...
                                        </>
                                    ) : incident.reviewed ? (
                                        <>
                                            <AlertTriangle className="mr-2 h-4 w-4" />
                                            Mark as Unreviewed
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="mr-2 h-4 w-4" />
                                            Mark as Reviewed
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

'use client';

import { useState } from 'react';
import { usePlatformEvents } from '@/internal/analytics/hooks/useMetrics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const PRODUCTS = ['', 'gateway', 'scan_web', 'scan_cli', 'dashboard', 'billing'] as const;

const PRODUCT_COLORS: Record<string, string> = {
    gateway: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    scan_web: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    scan_cli: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    dashboard: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    billing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export default function EventsPage() {
    const [product, setProduct] = useState('');
    const [eventType, setEventType] = useState('');
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const filters = {
        ...(product && { product }),
        ...(eventType && { event_type: eventType }),
        page,
        limit: 50,
    };

    const { data, isLoading, error, refetch } = usePlatformEvents(filters);

    const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

    return (
        <div className="w-full max-w-6xl mx-auto px-6 py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">Event Activity Feed</h1>
                    <p className="text-xs text-muted-foreground">
                        Real-time platform events across all products
                        {data && <span className="ml-1">({data.total.toLocaleString()} total)</span>}
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs rounded-full">
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Refresh
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <select
                    value={product}
                    onChange={(e) => { setProduct(e.target.value); setPage(1); }}
                    className="h-8 rounded-md border border-border/50 bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                    <option value="">All Products</option>
                    {PRODUCTS.filter(Boolean).map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>

                <input
                    type="text"
                    value={eventType}
                    onChange={(e) => { setEventType(e.target.value); setPage(1); }}
                    placeholder="Filter by event type..."
                    className="h-8 rounded-md border border-border/50 bg-card px-3 text-xs w-56 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />

                {(product || eventType) && (
                    <button
                        onClick={() => { setProduct(''); setEventType(''); setPage(1); }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Events Table */}
            {error ? (
                <div className="text-center py-12">
                    <p className="text-sm text-red-500">Failed to load events</p>
                </div>
            ) : isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 rounded-lg" />
                    ))}
                </div>
            ) : data && data.events.length > 0 ? (
                <div className="rounded-xl border border-border/50 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border/30 bg-card/50">
                                <th className="text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Time</th>
                                <th className="text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Event</th>
                                <th className="text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Product</th>
                                <th className="text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">User</th>
                                <th className="text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.events.map((event) => (
                                <tr
                                    key={event.id}
                                    className="border-b border-border/20 hover:bg-card/30 cursor-pointer transition-colors"
                                    onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                                >
                                    <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                                        {new Date(event.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <Badge variant="outline" className="text-[10px] font-mono">
                                            {event.event_type}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${PRODUCT_COLORS[event.product] || 'bg-secondary text-foreground border-border/50'}`}>
                                            {event.product}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground truncate max-w-[120px]">
                                        {event.user_id ? event.user_id.slice(0, 8) + '...' : '-'}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        {expandedId === event.id ? (
                                            <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap max-w-xs">
                                                {JSON.stringify(event.metadata, null, 2)}
                                            </pre>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground">
                                                {Object.keys(event.metadata).length > 0
                                                    ? `${Object.keys(event.metadata).length} fields`
                                                    : '-'}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">No events found</p>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                        Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="h-7 text-xs"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="h-7 text-xs"
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            <div className="text-center text-[10px] text-muted-foreground pt-4 border-t border-border/40">
                Auto-refreshing every 5 seconds
            </div>
        </div>
    );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { Wrench, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MaintenanceInfo {
    enabled: boolean;
    scheduled: { start: string; end: string } | null;
}

const DISMISS_KEY = 'cencori:maintenance-banner-dismissed';

function formatWindow(start: Date, end: Date): string {
    const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(start);
    const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    const zone =
        new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
            .formatToParts(start)
            .find((part) => part.type === 'timeZoneName')?.value ?? '';
    return `${day}, ${time.format(start)}–${time.format(end)} ${zone}`.trim();
}

// Announces a scheduled maintenance window (public.platform_maintenance) on
// every dashboard page. While maintenance is on, only bypass-token holders
// can see the dashboard; they get a reminder instead.
export function MaintenanceBanner() {
    const [dismissedFor, setDismissedFor] = useState<string | null>(null);

    useEffect(() => {
        try {
            setDismissedFor(localStorage.getItem(DISMISS_KEY));
        } catch {
            // Storage blocked: the banner just can't stay dismissed.
        }
    }, []);

    const { data } = useQuery<MaintenanceInfo | null>({
        queryKey: ['maintenance'],
        queryFn: async () => {
            const res = await fetch('/api/maintenance');
            if (!res.ok) return null;
            return res.json();
        },
        staleTime: 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
    });

    if (data?.enabled) {
        return (
            <div className="mb-4 flex shrink-0 items-center gap-3 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
                <Wrench className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">
                    <strong>Maintenance mode is on.</strong> Everyone else sees the maintenance page; you&apos;re through on the bypass.
                </span>
            </div>
        );
    }

    const scheduled = data?.scheduled;
    if (!scheduled) return null;
    // Dismissal is per window, so a rescheduled one shows again.
    const windowKey = `${scheduled.start}|${scheduled.end}`;
    if (dismissedFor === windowKey) return null;

    const start = new Date(scheduled.start);
    const end = new Date(scheduled.end);
    const inProgress = start.getTime() <= Date.now();

    return (
        <div className="mb-4 flex shrink-0 items-center gap-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-600 dark:text-amber-500">
            <Wrench className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">
                <strong>{inProgress ? 'Maintenance under way' : 'Scheduled maintenance'}:</strong>{' '}
                {formatWindow(start, end)}. The dashboard and API will be unavailable during this window while we move to
                our new infrastructure.{' '}
                <a
                    href="https://status.cencori.com"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:opacity-80"
                >
                    Status
                </a>
            </span>
            <button
                type="button"
                onClick={() => {
                    setDismissedFor(windowKey);
                    try {
                        localStorage.setItem(DISMISS_KEY, windowKey);
                    } catch {
                        // Storage blocked: dismissed for this page view only.
                    }
                }}
                className="shrink-0 opacity-50 transition-opacity hover:opacity-100"
                aria-label="Dismiss"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

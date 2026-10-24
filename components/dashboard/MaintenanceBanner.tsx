'use client';

import { useQuery } from '@tanstack/react-query';
import { Wrench, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface MaintenanceInfo {
    enabled: boolean;
    scheduled: { start: string; end: string } | null;
}

const DISMISS_KEY = 'cencori:maintenance-banner-dismissed';

/**
 * Set on <html> while the banner shows, so the fixed header, sidebar, mobile
 * nav and Copilot panel move down by it: `top-[var(--maintenance-banner-height,0px)]`.
 */
export const MAINTENANCE_BANNER_HEIGHT_VAR = '--maintenance-banner-height';
const BANNER_HEIGHT = '48px';

function formatWindow(start: Date, end: Date): string {
    const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(start);
    const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    const zone =
        new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
            .formatToParts(start)
            .find((part) => part.type === 'timeZoneName')?.value ?? '';
    return `${day}, ${time.format(start)}–${time.format(end)} ${zone}`.trim();
}

const statusLink = (
    <a
        href="https://status.cencori.com"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
    >
        status page
    </a>
);

// A full-width strip above the whole dashboard announcing a scheduled
// maintenance window (public.platform_maintenance). While maintenance is on,
// only bypass-token holders can see the dashboard; they get a reminder instead.
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

    const scheduled = data?.scheduled ?? null;
    // Dismissal is per window, so a rescheduled one shows again.
    const windowKey = scheduled ? `${scheduled.start}|${scheduled.end}` : null;
    const enabled = data?.enabled === true;
    const visible = enabled || (windowKey !== null && dismissedFor !== windowKey);

    useEffect(() => {
        if (!visible) return;
        const root = document.documentElement;
        root.style.setProperty(MAINTENANCE_BANNER_HEIGHT_VAR, BANNER_HEIGHT);
        return () => {
            root.style.removeProperty(MAINTENANCE_BANNER_HEIGHT_VAR);
        };
    }, [visible]);

    if (!visible) return null;

    let title: string;
    let detail: React.ReactNode;
    if (enabled) {
        title = 'Maintenance mode is on';
        detail = <>Everyone else sees the maintenance page; you&apos;re through on the bypass</>;
    } else {
        const start = new Date(scheduled!.start);
        const end = new Date(scheduled!.end);
        title = start.getTime() <= Date.now() ? 'Maintenance under way' : 'Scheduled maintenance';
        detail = (
            <>
                {formatWindow(start, end)}
                <span className="hidden md:inline">
                    {' '}· The dashboard and API will be unavailable · Follow the {statusLink} for updates
                </span>
            </>
        );
    }

    return (
        <div
            role="status"
            className={cn(
                'fixed inset-x-0 top-0 z-[60] flex h-12 items-center justify-center gap-2.5 border-b px-10 text-xs',
                enabled
                    ? 'border-red-500/20 bg-red-50 dark:bg-[#2a0e0e]'
                    : 'border-amber-500/20 bg-amber-50 dark:bg-[#2b1c06]',
            )}
        >
            <span
                className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-[4px] text-black',
                    enabled ? 'bg-red-500' : 'bg-amber-500',
                )}
            >
                <Wrench className="size-2.5" strokeWidth={2.75} />
            </span>
            <span className="min-w-0 truncate">
                <span className="font-medium text-foreground">{title}</span>
                <span className="text-muted-foreground"> · {detail}</span>
            </span>
            {!enabled && (
                <button
                    type="button"
                    onClick={() => {
                        setDismissedFor(windowKey);
                        try {
                            localStorage.setItem(DISMISS_KEY, windowKey!);
                        } catch {
                            // Storage blocked: dismissed for this page view only.
                        }
                    }}
                    className="absolute right-3 flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Dismiss"
                >
                    <X className="size-3.5" />
                </button>
            )}
        </div>
    );
}

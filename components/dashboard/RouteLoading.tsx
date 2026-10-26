"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Long enough that a slow server is the likely reason, not a slow network.
const STALLED_AFTER_MS = 12_000;

/**
 * Shown while a console page's code and data are on their way. No
 * page-shaped placeholder: a thin bar across the top of the content area,
 * faded in after a beat so quick navigations show nothing at all. A load
 * that stalls offers a reload instead of leaving a blank page.
 */
export function RouteLoading() {
    const [stalled, setStalled] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setStalled(true), STALLED_AFTER_MS);
        return () => window.clearTimeout(timer);
    }, []);

    return (
        <div role="status" aria-live="polite" aria-label="Loading" className="relative min-h-[50vh]">
            <div className="route-loading-bar pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden" />
            {stalled && (
                <div className="flex flex-col items-center gap-3 pt-32 text-center">
                    <p className="text-sm text-muted-foreground">This is taking longer than usual.</p>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.location.reload()}>
                        Reload
                    </Button>
                </div>
            )}
        </div>
    );
}

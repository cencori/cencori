"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { CloudCrossIcon } from "@solar-icons/react/bold-duotone/cloud-cross";
import { cn } from "@/lib/utils";

/**
 * How Studio loads data. Screens never wait for it (see studio-nav.tsx); the
 * data fills in after, and:
 * - offline, a request fails straight away (networkMode 'always') so the
 *   screen can say so, rather than hanging until the connection is back;
 * - what was already loaded stays on screen, and refreshes in the background
 *   when a screen is opened again;
 * - everything reloads by itself when the connection comes back.
 */
export function StudioDataProvider({ children }: { children: ReactNode }) {
    const [client] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                networkMode: "always",
                staleTime: 20_000,
                gcTime: 60 * 60_000,
                refetchOnMount: true,
                refetchOnReconnect: true,
                // One retry for a server hiccup; none when there's no connection to retry on.
                retry: (failures) => failures < 1 && isOnline(),
            },
            mutations: { networkMode: "always" },
        },
    }));
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function isOnline(): boolean {
    return typeof navigator === "undefined" || navigator.onLine !== false;
}

const subscribe = (notify: () => void) => onlineManager.subscribe(notify);

/** Whether the phone has a connection right now (updates as it changes). */
export function useOnline(): boolean {
    return useSyncExternalStore(subscribe, () => onlineManager.isOnline(), () => true);
}

/** fetch, but a dropped or missing connection reads as "You're offline" (for loads and for button presses). */
export async function studioFetch(input: string, init?: RequestInit): Promise<Response> {
    try {
        return await fetch(input, init);
    } catch (error) {
        if (!isOnline() || error instanceof TypeError) throw new Error(isOnline() ? "Couldn't reach Cencori. Check your connection and try again." : "You're offline. Try again when you're connected.");
        throw error;
    }
}

/** What went wrong loading, in words for the owner: offline first, else the server's message. */
export function loadErrorMessage(error: unknown, fallback: string): string {
    if (!isOnline() || (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) || (error instanceof Error && error.message.startsWith("You're offline"))) {
        return "You're offline. This will load when you're back online.";
    }
    return error instanceof Error && error.message ? error.message : fallback;
}

/** The data area when nothing could be loaded: offline, or an error, with a retry. */
export function StudioLoadError({ error, fallback, onRetry, className }: { error: unknown; fallback: string; onRetry?: () => void; className?: string }) {
    const message = loadErrorMessage(error, fallback);
    const offline = message.startsWith("You're offline");
    return (
        <div className={cn("mt-6 flex flex-col items-center rounded-3xl bg-muted/60 px-6 py-10 text-center", className)}>
            {offline && <CloudCrossIcon size={36} className="mb-2 text-muted-foreground" />}
            <p className={cn("text-sm leading-6", offline ? "text-muted-foreground" : "text-destructive")}>{message}</p>
            {onRetry && <button type="button" onClick={onRetry} className="mt-3 h-9 rounded-full border border-border/60 px-4 text-sm font-medium">Try again</button>}
        </div>
    );
}

/** A thin strip while offline, so data on screen is known to be from before. */
export function StudioOfflineStrip() {
    const online = useOnline();
    const [shown, setShown] = useState(false);
    // Hydration-safe: only after mount, where navigator is real.
    useEffect(() => setShown(!online), [online]);
    if (!shown) return null;
    return (
        <div role="status" className="fixed inset-x-0 top-0 z-50 mx-auto max-w-md bg-muted px-4 pb-1.5 pt-[calc(0.375rem+env(safe-area-inset-top))] text-center text-xs font-medium text-muted-foreground">
            You&apos;re offline. Showing what was loaded before.
        </div>
    );
}

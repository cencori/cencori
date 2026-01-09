"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

/**
 * UpdateToast - Shows a toast when a new version of the app is available
 * 
 * This component periodically checks the build ID from Next.js and compares
 * it with the initial build ID. If they differ, it shows a toast prompting
 * the user to refresh.
 */

const CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds
const IS_DEV = process.env.NODE_ENV === "development";
const TEST_DELAY = 5 * 1000; // Show toast after 5 seconds in dev mode for testing

export function UpdateToast() {
    const [showUpdateToast, setShowUpdateToast] = useState(false);
    const [initialBuildId, setInitialBuildId] = useState<string | null>(null);

    const checkForUpdates = useCallback(async () => {
        try {
            // Fetch the current page to get the build ID from Next.js
            const response = await fetch(window.location.href, {
                method: "HEAD",
                cache: "no-store",
            });

            // Get ETag or Last-Modified header as a version indicator
            const etag = response.headers.get("etag");
            const lastModified = response.headers.get("last-modified");
            const currentVersion = etag || lastModified || null;

            if (!currentVersion) return;

            if (initialBuildId === null) {
                // First check - store the initial version
                setInitialBuildId(currentVersion);
            } else if (currentVersion !== initialBuildId) {
                // Version changed - show update toast
                setShowUpdateToast(true);
            }
        } catch (error) {
            // Silently fail - don't disrupt user experience
            console.debug("Update check failed:", error);
        }
    }, [initialBuildId]);

    useEffect(() => {
        // In development mode, show toast after TEST_DELAY for testing
        if (IS_DEV) {
            const testTimeout = setTimeout(() => {
                setShowUpdateToast(true);
            }, TEST_DELAY);

            return () => clearTimeout(testTimeout);
        }

        // Production mode: check for real updates
        checkForUpdates();
        const interval = setInterval(checkForUpdates, CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, [checkForUpdates]);

    const handleRefresh = () => {
        window.location.reload();
    };

    const handleDismiss = () => {
        setShowUpdateToast(false);
        // In dev mode, don't re-show automatically
        if (!IS_DEV) {
            // Re-show after 5 minutes if still not refreshed
            setTimeout(() => setShowUpdateToast(true), 5 * 60 * 1000);
        }
    };

    if (!showUpdateToast) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="flex flex-col gap-3 px-4 py-3 bg-card border border-border/50 rounded-lg shadow-lg max-w-xs">
                <div>
                    <p className="text-sm font-medium">A new version of this page is available</p>
                    <p className="text-xs text-muted-foreground">Refresh to see the latest changes.</p>
                </div>
                <div className="flex items-center gap-2 justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDismiss}
                        className="h-7 px-2 text-xs text-muted-foreground"
                    >
                        Not now
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleRefresh}
                        className="h-7 px-3 text-xs"
                    >
                        Refresh
                    </Button>
                </div>
            </div>
        </div>
    );
}

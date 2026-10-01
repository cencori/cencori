"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const RESOLVE_TIMEOUT_MS = 10_000;
// If the refreshed render still lands back here, cookies aren't sticking
// (blocked storage, dropped Set-Cookie). Refreshing again would loop
// forever on a blank screen, so fail visibly instead.
const MAX_AUTO_REFRESHES = 1;
// router.refresh() does not remount us — if the refreshed render still
// resolves to this page, no effect refires and no guard trips. Watchdog
// turns that silent stall into a visible, retryable error.
const POST_REFRESH_WATCHDOG_MS = 6_000;

export default function ConsoleWorkspaceBootstrapPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const refreshesRef = useRef(0);
  const settledRef = useRef(false);

  useEffect(() => {
    return () => {
      settledRef.current = true;
    };
  }, []);

  const resolveWorkspace = useCallback(async () => {
    setError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);

    try {
      const response = await fetch("/api/console/context", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Could not load your console workspace.");

      const payload = (await response.json()) as { workspace?: unknown };
      if (!payload.workspace) {
        settledRef.current = true;
        router.replace("/onboarding");
        return;
      }

      // The context response sets the active workspace cookies. Refreshing
      // keeps the requested public URL while middleware routes it internally.
      // If we're still mounted after the watchdog window, the refreshed
      // render resolved back here — cookies didn't apply — so say so
      // instead of hanging on the skeleton.
      refreshesRef.current += 1;
      if (refreshesRef.current > MAX_AUTO_REFRESHES) {
        throw new Error(
          "Your workspace was found but this browser isn't keeping its context. Check cookie settings, then try again.",
        );
      }
      router.refresh();
      setTimeout(() => {
        if (!settledRef.current) {
          setError(
            "Your workspace was found but this page isn't picking it up. Check cookie settings, then try again.",
          );
        }
      }, POST_REFRESH_WATCHDOG_MS);
    } catch (bootstrapError) {
      if (settledRef.current) return;
      setError(
        bootstrapError instanceof DOMException && bootstrapError.name === "AbortError"
          ? "Loading your workspace is taking too long. Check your connection, then try again."
          : bootstrapError instanceof Error
            ? bootstrapError.message
            : "Could not load your console workspace.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }, [router]);

  useEffect(() => {
    void resolveWorkspace();
  }, [resolveWorkspace]);

  if (!error) {
    return (
      <div
        className="mx-auto w-full max-w-[1360px] px-6 py-8"
        role="status"
        aria-label="Loading dashboard"
      >
        <div className="mb-8 space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
        <Skeleton className="mt-4 h-64 rounded-xl" />
        <span className="sr-only">Loading the dashboard</span>
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-start justify-center px-6">
      <h1 className="text-lg font-medium">Console unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      <Button type="button" size="sm" className="mt-5" onClick={() => void resolveWorkspace()}>
        Try again
      </Button>
    </main>
  );
}

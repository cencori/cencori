"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ConsoleWorkspaceBootstrapPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const resolveWorkspace = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch("/api/console/context", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Could not load your console workspace.");

      const payload = await response.json() as { workspace?: unknown };
      if (!payload.workspace) {
        router.replace("/onboarding");
        return;
      }

      // The context response sets the active workspace cookies. Refreshing
      // keeps the requested public URL while middleware routes it internally.
      router.refresh();
    } catch (bootstrapError) {
      setError(
        bootstrapError instanceof Error
          ? bootstrapError.message
          : "Could not load your console workspace.",
      );
    }
  }, [router]);

  useEffect(() => {
    void resolveWorkspace();
  }, [resolveWorkspace]);

  if (!error) return null;

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

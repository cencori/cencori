"use client";

import posthog from "posthog-js";
import type { HeardAboutSource, HeardAboutSurface } from "@/lib/heard-about";

/** Save the answer and send it to PostHog. Best-effort: never holds up signing up. */
export async function sendHeardAbout(source: HeardAboutSource, detail: string | null, surface: HeardAboutSurface): Promise<void> {
    try {
        // Also kept on the person (first answer only), for breakdowns of everything they do.
        posthog.capture("heard_about_answered", { source, detail, surface, $set_once: { heard_about: source } });
    } catch {
        // Analytics is optional.
    }
    await fetch("/api/me/heard-about", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, detail, surface }),
        // Onboarding navigates away straight after; the answer still arrives.
        keepalive: true,
    }).catch(() => undefined);
}

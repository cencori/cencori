"use client";

import { useQuery } from "@tanstack/react-query";
import { studioFetch } from "@/components/studio/studio-data";
import { useStudio } from "@/components/studio/StudioShell";

export interface StudioEventTier { id: string; name: string; price: number; capacity: number | null; sold: number }

export interface StudioEventSummary {
    event: { id: string; slug: string; name: string; description: string; venue: string; starts_at: string; ends_at: string | null; currency: string; status: "live" | "closed" | "cancelled"; banner_url: string | null; tiers: Array<{ id: string; name: string; price: number; capacity: number | null }> };
    sold: number;
    capacity: number | null;
    earned: number;
    checked_in: number;
    by_tier: StudioEventTier[];
}

export interface StudioGuest { id: string; tier_id: string; code: string; buyer_name: string; buyer_phone: string | null; price: number; paid_at: string | null; checked_in_at: string | null }

async function get<T>(url: string): Promise<T> {
    const response = await studioFetch(url, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? "Couldn't load your events.");
    return body as T;
}

export function useEvents() {
    const { project } = useStudio();
    return useQuery({
        queryKey: ["studio-events", project.id],
        queryFn: () => get<{ events: StudioEventSummary[] }>(`/api/studio/events?project_id=${project.id}`),
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
    });
}

export function useEvent(eventId: string) {
    const { project } = useStudio();
    return useQuery({
        queryKey: ["studio-event", project.id, eventId],
        queryFn: () => get<{ event: StudioEventSummary; guests: StudioGuest[] }>(`/api/studio/events?project_id=${project.id}&event_id=${eventId}`),
        refetchInterval: 15_000,
        refetchOnWindowFocus: true,
    });
}

/** Events happen in Lagos: their times are shown and typed in Lagos time, whatever the device's own zone. */
export const EVENT_TIME_ZONE = "Africa/Lagos";

/** "Sat 20 Dec · 8:00 pm", in Lagos time. */
export function eventWhen(iso: string): string {
    const date = new Date(iso);
    const day = date.toLocaleDateString("en-GB", { timeZone: EVENT_TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
    const time = date.toLocaleTimeString("en-GB", { timeZone: EVENT_TIME_ZONE, hour: "numeric", minute: "2-digit", hour12: true });
    return `${day} · ${time}`;
}

/** An instant as a datetime-local value ("2026-12-20T20:00") in Lagos time. */
export function lagosInput(iso: string): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
}

/** A datetime-local value typed as Lagos time, as an instant (Lagos is UTC+1 all year, no daylight saving). */
export function fromLagosInput(value: string): string {
    return value ? new Date(`${value}:00+01:00`).toISOString() : "";
}

export function eventLink(slug: string): string {
    const host = typeof window === "undefined" ? "studio.cencori.com" : window.location.host;
    return `${typeof window === "undefined" ? "https:" : window.location.protocol}//${host}/e/${slug}`;
}

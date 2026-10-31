"use client";

import { DEFAULT_TIME_ZONE, zonedInstant } from "@/lib/studio/time";
import { useStudioOverview } from "@/components/studio/useStudioOverview";
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

/**
 * The business's time zone (overview's time_zone, lib/studio/business-zone.ts): event times are
 * shown and typed in it, whatever zone this phone or laptop is in. Lagos until the overview loads.
 */
export function useBusinessTimeZone(): string {
    return useStudioOverview().data?.time_zone ?? DEFAULT_TIME_ZONE;
}

/** "Sat 20 Dec · 8:00 pm", in the business's zone. */
export function eventWhen(iso: string, timeZone: string): string {
    const date = new Date(iso);
    const day = date.toLocaleDateString("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" });
    const time = date.toLocaleTimeString("en-GB", { timeZone, hour: "numeric", minute: "2-digit", hour12: true });
    return `${day} · ${time}`;
}

/** An instant as a datetime-local value ("2026-12-20T20:00") on the business's clock. */
export function zoneInput(iso: string, timeZone: string): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
}

/** A datetime-local value typed on the business's clock, as an instant (daylight saving included). */
export function fromZoneInput(value: string, timeZone: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) return "";
    const [, year, month, day, hour, minute] = match.map(Number);
    return zonedInstant(timeZone, year, month, day, hour, minute).toISOString();
}

export function eventLink(slug: string): string {
    const host = typeof window === "undefined" ? "studio.cencori.com" : window.location.host;
    return `${typeof window === "undefined" ? "https:" : window.location.protocol}//${host}/e/${slug}`;
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { studioFetch } from "@/components/studio/studio-data";
import { useStudio } from "@/components/studio/StudioShell";

export interface StudioAssistantSummary {
    id: string;
    name: string;
    published: boolean;
    template: string | null;
    system_tools: string[];
    connected_apps: Array<{ app: string; tools_on: number }>;
    payments: { provider: string | null; mode: string | null; currency: string | null } | null;
    products: { count: number; currency: string; orders_to_fulfil: number } | null;
    knowledge: Array<{ id?: string; name: string; status: string }>;
    website_chat: { on: boolean; sites: string[] } | null;
    whatsapp: { number: string | null; replies_on: boolean } | null;
    owner_alerts: { emails: string[] } | null;
    still_to_do: string[];
}

export interface StudioOverview {
    assistant: StudioAssistantSummary | null;
    share_token: string | null;
    time_zone: string;
    brief: { headline: string; points: string[]; at: string } | null;
    today: { chats: number; earned?: { amount: number; count: number } };
    month: { chats: number; earned?: { amount: number; count: number } };
    currency: string;
    payments_connected: boolean;
    plan: {
        name: string;
        conversations: number;
        /** Chats answered before the assistant stops: the plan's, plus the extras. */
        capacity: number;
        agents: number;
        used: number;
        active: boolean;
        /** Past its end date, still answering until grace_end. */
        in_grace: boolean;
        period_end: string | null;
        grace_end: string | null;
        /** What came in through the assistant since this plan started. */
        earned: { amount: number; count: number } | null;
    } | null;
}

/** Home's data (and one assistant's, with agentId): one request, refreshed when the owner comes back to the app. */
export function useStudioOverview(agentId?: string) {
    const { project } = useStudio();
    return useQuery({
        queryKey: agentId ? ["studio-overview", project.id, agentId] : ["studio-overview", project.id],
        queryFn: async (): Promise<StudioOverview> => {
            const response = await studioFetch(`/api/studio/overview?project_id=${project.id}${agentId ? `&agent_id=${agentId}` : ""}`, { cache: "no-store" });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? "Couldn't load your business.");
            return body as StudioOverview;
        },
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    });
}

export function formatMoney(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat("en-NG", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString("en-NG")}`;
    }
}

/** Where the assistant is answering customers, in plain words ("WhatsApp, your website and your link"). */
export function liveChannels(assistant: StudioAssistantSummary | null): string[] {
    if (!assistant?.published) return [];
    return [
        assistant.whatsapp?.replies_on && "WhatsApp",
        assistant.website_chat?.on && "your website",
        assistant.website_chat && "your link",
    ].filter((item): item is string => !!item);
}

export function joinWords(items: string[]): string {
    if (items.length <= 1) return items.join("");
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Copilot's "still to do" notes as owner-facing steps (they carry hints for
 * Copilot in brackets, which the owner never sees).
 */
export function setupSteps(items: string[]): string[] {
    return items
        .map((item) => item.replace(/\s*\([^)]*\)\s*$/, "").replace(/^optional:\s*/i, "").trim())
        .map((item) => (item === "publish" ? "go live" : item))
        .filter(Boolean)
        .map((item) => item.charAt(0).toUpperCase() + item.slice(1));
}

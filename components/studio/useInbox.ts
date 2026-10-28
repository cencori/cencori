"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { studioFetch } from "@/components/studio/studio-data";
import { useStudio } from "@/components/studio/StudioShell";

export type InboxChannel = "whatsapp" | "website" | "link" | "other";

export interface InboxConversation {
    id: string;
    channel: InboxChannel;
    name: string;
    /** A real name (WhatsApp gives one), not a stand-in like "Website visitor". */
    named: boolean;
    /** What they came for, from their first message; null when it was only a greeting. */
    topic: string | null;
    number: string | null;
    last_message: string | null;
    last_from: "customer" | "assistant" | "owner" | null;
    updated_at: string;
    open: boolean;
    needs_owner: { reason: string; at: string } | null;
    owner_active: boolean;
    /** The customer wrote since you last opened it. */
    unread: boolean;
}

export interface InboxMessage {
    id: string;
    from: "customer" | "assistant" | "owner";
    text: string;
    at: string;
}

export type ReplyAbility = { possible: true; reason: null } | { possible: false; reason: "website" | "window" };
type ConversationPayload = { conversation: InboxConversation; messages: InboxMessage[]; reply: ReplyAbility };

export const CHANNEL_LABEL: Record<InboxChannel, string> = { whatsapp: "WhatsApp", website: "Website", link: "Link", other: "Chat" };

async function read<T>(url: string): Promise<T> {
    const response = await studioFetch(url, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? "Couldn't load your chats.");
    return body as T;
}

/** The conversation list, refreshed every 15 seconds while it's on screen. */
export function useInbox(channel: InboxChannel | null) {
    const { project } = useStudio();
    return useQuery({
        queryKey: ["studio-inbox", project.id, channel],
        queryFn: () => read<{ conversations: InboxConversation[] }>(`/api/studio/inbox?project_id=${project.id}${channel ? `&channel=${channel}` : ""}`),
        refetchInterval: 15_000,
        refetchOnWindowFocus: true,
    });
}

/** How many chats are unread for you (the Inbox tab's badge). */
export function useUnreadCount(): number {
    const inbox = useInbox(null);
    return (inbox.data?.conversations ?? []).filter((conversation) => conversation.unread).length;
}

/** Mark a chat read or unread from the list, without opening it. */
export function useMarkRead() {
    const { project } = useStudio();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, read }: { id: string; read: boolean }) => {
            const response = await studioFetch(`/api/studio/inbox/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project_id: project.id, action: read ? "mark_read" : "mark_unread" }),
            });
            if (!response.ok) throw new Error("That didn't work. Try again.");
        },
        onMutate: ({ id, read }) => {
            // Show it straight away; the next refresh confirms it.
            queryClient.setQueriesData<{ conversations: InboxConversation[] }>({ queryKey: ["studio-inbox", project.id] }, (data) =>
                data && { conversations: data.conversations.map((conversation) => (conversation.id === id ? { ...conversation, unread: !read } : conversation)) });
        },
        onSettled: () => void queryClient.invalidateQueries({ queryKey: ["studio-inbox", project.id] }),
    });
}

export function useConversation(id: string) {
    const { project } = useStudio();
    return useQuery({
        queryKey: ["studio-conversation", project.id, id],
        queryFn: () => read<ConversationPayload>(`/api/studio/inbox/${id}?project_id=${project.id}`),
        refetchInterval: 10_000,
        refetchOnWindowFocus: true,
    });
}

/** Step in, hand back, or reply as the owner; the conversation and the list refresh after. */
export function useConversationAction(id: string) {
    const { project } = useStudio();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { action: "step_in" | "hand_back" | "reply" | "mark_read" | "mark_unread"; text?: string }) => {
            const response = await studioFetch(`/api/studio/inbox/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project_id: project.id, ...input }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? "That didn't work. Try again.");
            return body as ConversationPayload;
        },
        onSuccess: (data) => {
            queryClient.setQueryData(["studio-conversation", project.id, id], data);
            void queryClient.invalidateQueries({ queryKey: ["studio-inbox", project.id] });
        },
    });
}

/** "now", "4m", "2h", "Yesterday", "Mon", "12 Oct". */
export function shortTime(iso: string): string {
    const then = new Date(iso);
    const minutes = Math.round((Date.now() - then.getTime()) / 60_000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 24 && then.getDate() === new Date().getDate()) return `${hours}h`;
    const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
    if (days <= 1) return "Yesterday";
    if (days < 7) return then.toLocaleDateString("en-GB", { weekday: "short" });
    return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function initials(name: string): string {
    const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
}

/** What a conversation is called in Studio: the customer's name, else what they came for, else where they came from. */
export function conversationTitle(conversation: Pick<InboxConversation, "named" | "name" | "topic">): string {
    return conversation.named ? conversation.name : conversation.topic ?? conversation.name;
}

/** "Wants a call back: …" → "Wants a callback": the short tag for why a chat needs the owner. */
export function needsOwnerLabel(reason: string): string {
    if (/^wants a call ?back/i.test(reason)) return "Wants a callback";
    if (/^says they('|’)ve paid/i.test(reason)) return "Says they've paid";
    return "Asked for you";
}

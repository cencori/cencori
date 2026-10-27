"use client";

import { useState } from "react";
import Link from "next/link";
import { CHANNEL_LABEL, initials, shortTime, useInbox, type InboxChannel } from "@/components/studio/useInbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Filter = InboxChannel | "needs" | null;

const FILTERS: Array<{ id: Filter; label: string }> = [
    { id: null, label: "All" },
    { id: "needs", label: "Needs you" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "website", label: "Website" },
    { id: "link", label: "Link" },
];

/** Every conversation from every channel, newest first. */
export default function StudioInboxPage() {
    const [channel, setChannel] = useState<Filter>(null);
    const inbox = useInbox(channel === "needs" ? null : channel);
    const all = inbox.data?.conversations ?? [];
    const waiting = all.filter((conversation) => conversation.needs_owner || conversation.owner_active);
    const conversations = channel === "needs" ? waiting : all;

    return (
        <div>
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight">Inbox</h1>
            <div role="tablist" aria-label="Show" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
                {FILTERS.map((filter) => (
                    <button
                        key={filter.label}
                        type="button"
                        role="tab"
                        aria-selected={channel === filter.id}
                        onClick={() => setChannel(filter.id)}
                        className={cn(
                            "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                            channel === filter.id ? "border-foreground bg-foreground text-background" : "border-border/60 text-muted-foreground",
                        )}
                    >
                        {filter.label}{filter.id === "needs" && channel !== "needs" && waiting.length > 0 ? ` · ${waiting.length}` : ""}
                    </button>
                ))}
            </div>

            {inbox.isLoading ? (
                <div className="mt-4 space-y-4">
                    {[0, 1, 2, 3, 4].map((index) => (
                        <div key={index} className="flex gap-3">
                            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                            <div className="flex-1 space-y-2 pt-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3.5 w-full" /></div>
                        </div>
                    ))}
                </div>
            ) : inbox.isError ? (
                <p className="mt-6 text-sm text-destructive">{inbox.error instanceof Error ? inbox.error.message : "Couldn't load your chats."}</p>
            ) : conversations.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-border/60 px-4 py-5 text-sm leading-6 text-muted-foreground">
                    {channel === "needs" ? "Nothing needs you right now. Your assistant is handling every chat." : channel ? `No ${CHANNEL_LABEL[channel]} chats yet.` : "No chats yet. When customers message your assistant, the conversations show up here."}
                </p>
            ) : (
                <ul className="-mx-4 mt-3">
                    {conversations.map((conversation) => (
                        <li key={conversation.id}>
                            <Link href={`/inbox/${conversation.id}`} className="flex gap-3 border-b border-border/40 px-4 py-3 active:bg-muted/60">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials(conversation.name)}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-baseline gap-2">
                                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{conversation.name}</span>
                                        <span className="shrink-0 text-xs text-muted-foreground">{shortTime(conversation.updated_at)}</span>
                                    </span>
                                    <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                                        {conversation.last_from === "assistant" ? "Assistant: " : conversation.last_from === "owner" ? "You: " : ""}{conversation.last_message ?? "No messages yet"}
                                    </span>
                                    <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/80">
                                        {CHANNEL_LABEL[conversation.channel]}
                                        {conversation.owner_active ? (
                                            <span className="rounded-full bg-orange-100 px-2 py-0.5 font-semibold text-orange-800 dark:bg-orange-500/15 dark:text-orange-300">You&apos;re replying</span>
                                        ) : conversation.needs_owner ? (
                                            <span className="rounded-full bg-orange-100 px-2 py-0.5 font-semibold text-orange-800 dark:bg-orange-500/15 dark:text-orange-300">Needs you</span>
                                        ) : null}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

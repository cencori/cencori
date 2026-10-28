"use client";

import { useRef, useState } from "react";
import { StudioLoadError } from "@/components/studio/studio-data";
import { StudioLink } from "@/components/studio/studio-nav";
import { Drawer } from "vaul";
import { CHANNEL_LABEL, initials, shortTime, useInbox, useMarkRead, type InboxChannel, type InboxConversation } from "@/components/studio/useInbox";
import { ChatRoundDotsIcon } from "@solar-icons/react/bold-duotone/chat-round-dots";
import { ChatRoundCheckIcon } from "@solar-icons/react/bold-duotone/chat-round-check";
import { STUDIO_FILL_PAGE, StudioEmptyCard } from "@/components/studio/StudioEmptyCard";
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
    const empty = !!inbox.data && conversations.length === 0;
    const markRead = useMarkRead();
    // Long-press a chat for "Mark as read / unread", the way phones do it.
    const [held, setHeld] = useState<InboxConversation | null>(null);
    const press = useRef<{ timer: number; fired: boolean } | null>(null);
    const startPress = (conversation: InboxConversation) => {
        press.current = { fired: false, timer: window.setTimeout(() => {
            if (press.current) press.current.fired = true;
            navigator.vibrate?.(10);
            setHeld(conversation);
        }, 500) };
    };
    const endPress = () => {
        if (press.current) window.clearTimeout(press.current.timer);
    };

    return (
        <div className={empty ? STUDIO_FILL_PAGE : undefined}>
            {/* The title and filters stay put while the chats scroll under them. */}
            <div className="sticky top-0 z-30 -mx-4 -mt-[calc(1.25rem+env(safe-area-inset-top))] bg-background px-4 pb-3 pt-[calc(1.25rem+env(safe-area-inset-top))] lg:-mx-10 lg:-mt-10 lg:px-10 lg:pt-10">
                <h1 className="text-[26px] font-semibold leading-tight tracking-tight">Inbox</h1>
                <div role="tablist" aria-label="Show" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:-mx-10 lg:px-10">
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
            </div>

            {inbox.isPending && !inbox.isError ? (
                <div className="mt-4 space-y-4">
                    {[0, 1, 2, 3, 4].map((index) => (
                        <div key={index} className="flex gap-3">
                            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                            <div className="flex-1 space-y-2 pt-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3.5 w-full" /></div>
                        </div>
                    ))}
                </div>
            ) : !inbox.data ? (
                <StudioLoadError error={inbox.error} fallback="Couldn't load your chats." onRetry={() => void inbox.refetch()} />
            ) : conversations.length === 0 ? (
                channel === "needs" ? (
                    <StudioEmptyCard icon={ChatRoundCheckIcon} title="Nothing needs you" description="Your assistant is handling every chat." />
                ) : (
                    <StudioEmptyCard
                        icon={ChatRoundDotsIcon}
                        title={channel ? `No ${CHANNEL_LABEL[channel]} chats yet` : "No chats yet"}
                        description="When customers message your assistant, the conversations show up here."
                    />
                )
            ) : (
                <ul className="-mx-4 mt-3 lg:mx-0">
                    {conversations.map((conversation) => (
                        <li key={conversation.id}>
                            <StudioLink
                                href={`/inbox/${conversation.id}`}
                                onPointerDown={() => startPress(conversation)}
                                onPointerUp={endPress}
                                onPointerLeave={endPress}
                                onPointerCancel={endPress}
                                onContextMenu={(event) => { event.preventDefault(); endPress(); setHeld(conversation); }}
                                onClick={(event) => { if (press.current?.fired) event.preventDefault(); press.current = null; }}
                                className="flex select-none gap-3 border-b border-border/40 px-4 py-3 [-webkit-touch-callout:none] active:bg-muted/60"
                            >
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials(conversation.name)}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-baseline gap-2">
                                        <span className={cn("min-w-0 flex-1 truncate text-[15px]", conversation.unread ? "font-bold" : "font-medium")}>{conversation.name}</span>
                                        <span className={cn("flex shrink-0 items-center gap-1.5 text-xs", conversation.unread ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                                            {shortTime(conversation.updated_at)}
                                            {conversation.unread && <span aria-label="Unread" className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />}
                                        </span>
                                    </span>
                                    <span className={cn("mt-0.5 block truncate text-[13px]", conversation.unread ? "font-medium text-foreground" : "text-muted-foreground")}>
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
                            </StudioLink>
                        </li>
                    ))}
                </ul>
            )}

            <Drawer.Root open={!!held} onOpenChange={(open) => { if (!open) setHeld(null); }}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-50 bg-black/30" />
                    <Drawer.Content className="dashboard-theme fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md lg:left-[var(--studio-sidebar,0px)] rounded-t-3xl border-t border-border/60 bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 font-sans text-foreground outline-none">
                        <Drawer.Title className="truncate px-1 text-[15px] font-semibold">{held?.name}</Drawer.Title>
                        <Drawer.Description className="sr-only">Chat options</Drawer.Description>
                        <button
                            type="button"
                            onClick={() => { if (held) markRead.mutate({ id: held.id, read: held.unread }); setHeld(null); }}
                            className="mt-3 h-12 w-full rounded-2xl bg-muted text-[15px] font-medium"
                        >
                            {held?.unread ? "Mark as read" : "Mark as unread"}
                        </button>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        </div>
    );
}

"use client";

import { useRef, useState } from "react";
import { StudioLoadError } from "@/components/studio/studio-data";
import { StudioLink } from "@/components/studio/studio-nav";
import { Drawer } from "vaul";
import { CHANNEL_LABEL, conversationTitle, needsOwnerLabel, shortTime, useInbox, useMarkRead, type InboxChannel, type InboxConversation } from "@/components/studio/useInbox";
import { ConversationAvatar } from "@/components/studio/ConversationAvatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Check } from "lucide-react";
import { TuningIcon } from "@solar-icons/react/linear/tuning";
import { ChatRoundDotsIcon } from "@solar-icons/react/bold-duotone/chat-round-dots";
import { ChatRoundCheckIcon } from "@solar-icons/react/bold-duotone/chat-round-check";
import { STUDIO_FILL_PAGE, StudioEmptyCard } from "@/components/studio/StudioEmptyCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type View = "all" | "needs" | "unread";
const VIEWS: Array<{ id: View; label: string }> = [{ id: "all", label: "All" }, { id: "needs", label: "Needs you" }, { id: "unread", label: "Unread" }];
const CHANNELS: Array<InboxChannel | null> = [null, "whatsapp", "website", "link"];

/** Today, Yesterday or Earlier, for the day labels. */
function dayOf(iso: string): "Today" | "Yesterday" | "Earlier" {
    const then = new Date(iso);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (then >= start) return "Today";
    start.setDate(start.getDate() - 1);
    return then >= start ? "Yesterday" : "Earlier";
}

/** Every conversation from every channel, newest first. */
export default function StudioInboxPage() {
    const [view, setView] = useState<View>("all");
    const [channel, setChannel] = useState<InboxChannel | null>(null);
    const inbox = useInbox(channel);
    const all = inbox.data?.conversations ?? [];
    const needsYou = (conversation: InboxConversation) => !!conversation.needs_owner || conversation.owner_active;
    const waiting = all.filter(needsYou);
    const unreadCount = all.filter((conversation) => conversation.unread).length;
    const conversations = view === "needs" ? waiting : view === "unread" ? all.filter((conversation) => conversation.unread) : all;
    const empty = !!inbox.data && conversations.length === 0;
    // "Needs you" first, then the rest by day.
    const groups: Array<{ label: string; items: InboxConversation[] }> = [];
    if (view === "all" && waiting.length) groups.push({ label: "Needs you", items: waiting });
    for (const conversation of view === "all" ? conversations.filter((item) => !needsYou(item)) : conversations) {
        const label = dayOf(conversation.updated_at);
        const group = groups.find((item) => item.label === label);
        if (group) group.items.push(conversation);
        else groups.push({ label, items: [conversation] });
    }
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
                <div className="flex items-center justify-between">
                    <h1 className="text-[26px] font-semibold leading-tight tracking-tight">Inbox</h1>
                    {/* Where the chats came from: rarely needed, so tucked away. */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button type="button" aria-label="Filter by channel" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                <TuningIcon size={20} />
                                {channel && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500" />}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-44 rounded-2xl p-1">
                            {CHANNELS.map((item) => (
                                <DropdownMenuItem key={item ?? "all"} onSelect={() => setChannel(item)} className="flex h-10 items-center justify-between rounded-xl px-3 text-[15px]">
                                    {item ? CHANNEL_LABEL[item] : "Every channel"}
                                    {channel === item && <Check className="h-4 w-4" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div role="tablist" aria-label="Show" className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
                    {VIEWS.map((item) => {
                        const count = item.id === "needs" ? waiting.length : item.id === "unread" ? unreadCount : 0;
                        return (
                            <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => setView(item.id)} className={cn("h-9 rounded-full text-sm font-medium", view === item.id ? "bg-background text-foreground" : "text-muted-foreground")}>
                                {item.label}{count && view !== item.id ? ` · ${count > 9 ? "9+" : count}` : ""}
                            </button>
                        );
                    })}
                </div>
                {channel && (
                    <button type="button" onClick={() => setChannel(null)} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-muted px-3 text-[13px] font-medium">
                        {CHANNEL_LABEL[channel]} only <span aria-hidden className="text-muted-foreground">✕</span>
                    </button>
                )}
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
                view === "needs" ? (
                    <StudioEmptyCard icon={ChatRoundCheckIcon} title="Nothing needs you" description="Your assistant is handling every chat." />
                ) : view === "unread" ? (
                    <StudioEmptyCard icon={ChatRoundCheckIcon} title="All caught up" description="No unread chats." />
                ) : (
                    <StudioEmptyCard
                        icon={ChatRoundDotsIcon}
                        title={channel ? `No ${CHANNEL_LABEL[channel]} chats yet` : "No chats yet"}
                        description="When customers message your assistant, the conversations show up here."
                    />
                )
            ) : (
                <div className="mt-2">
                    {groups.map((group) => (
                        <section key={group.label} className="mt-5 first:mt-3">
                            <h2 className="mb-1 px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</h2>
                            {/* Lines between chats start where the text does, under the avatar's right edge (as phones' chat lists have them). */}
                            <ul className="-mx-4 lg:mx-0 [&>li+li>a]:relative [&>li+li>a]:before:absolute [&>li+li>a]:before:left-[4.25rem] [&>li+li>a]:before:right-0 [&>li+li>a]:before:top-0 [&>li+li>a]:before:h-px [&>li+li>a]:before:bg-border/50">
                                {group.items.map((conversation) => (
                                    <li key={conversation.id}>
                                        <StudioLink
                                            href={`/inbox/${conversation.id}`}
                                            onPointerDown={() => startPress(conversation)}
                                            onPointerUp={endPress}
                                            onPointerLeave={endPress}
                                            onPointerCancel={endPress}
                                            onContextMenu={(event) => { event.preventDefault(); endPress(); setHeld(conversation); }}
                                            onClick={(event) => { if (press.current?.fired) event.preventDefault(); press.current = null; }}
                                            className="flex select-none items-center gap-3 px-4 py-3 [-webkit-touch-callout:none] active:bg-muted/60"
                                        >
                                            <ConversationAvatar conversation={conversation} />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-baseline gap-2">
                                                    <span className={cn("min-w-0 flex-1 truncate text-[15px]", conversation.unread ? "font-bold" : "font-medium")}>{conversationTitle(conversation)}</span>
                                                    <span className={cn("flex shrink-0 items-center gap-1.5 text-xs", conversation.unread ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                                                        {shortTime(conversation.updated_at)}
                                                        {conversation.unread && <span aria-label="Unread" className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />}
                                                    </span>
                                                </span>
                                                <span className="mt-0.5 flex items-center gap-2">
                                                    {(conversation.owner_active || conversation.needs_owner) && (
                                                        <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                                            {conversation.owner_active ? "You're replying" : needsOwnerLabel(conversation.needs_owner!.reason)}
                                                        </span>
                                                    )}
                                                    <span className={cn("min-w-0 truncate text-[13px]", conversation.unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                                                        {conversation.last_from === "owner" ? "You: " : ""}{conversation.last_message ?? "No messages yet"}
                                                    </span>
                                                </span>
                                            </span>
                                        </StudioLink>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}

            <Drawer.Root repositionInputs={false} open={!!held} onOpenChange={(open) => { if (!open) setHeld(null); }}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-50 bg-black/30" />
                    <Drawer.Content className="dashboard-theme fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md lg:left-[var(--studio-sidebar,0px)] rounded-t-3xl border-t border-border/60 bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 font-sans text-foreground outline-none">
                        <Drawer.Title className="truncate px-1 text-[15px] font-semibold">{held ? conversationTitle(held) : ""}</Drawer.Title>
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

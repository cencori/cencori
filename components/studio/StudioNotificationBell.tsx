"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { SHEET_AS_PAGE, SHEET_OVERLAY_PHONE_ONLY, SheetPageBack } from "@/components/studio/studio-sheet";
import { BellIcon } from "@solar-icons/react/bold-duotone/bell";
import { ChatRoundCheckIcon } from "@solar-icons/react/bold-duotone/chat-round-check";
import { StudioLink } from "@/components/studio/studio-nav";
import { StudioNotificationsCard } from "@/components/studio/StudioNotifications";
import { shortTime, useInbox, type InboxConversation } from "@/components/studio/useInbox";
import { cn } from "@/lib/utils";

/** Chats waiting on the owner: the assistant handed them over (or a transfer to check), or the owner is mid-reply. */
export function useNeedsYou(): InboxConversation[] {
    const inbox = useInbox(null);
    return (inbox.data?.conversations ?? []).filter((conversation) => conversation.needs_owner || conversation.owner_active);
}

const SNAPS = [0.6, 1] as const;

/**
 * The bell on Home: a count, and a Notifications sheet grouped by category.
 * Needs you (chats waiting on the owner) is the first; tapping one opens the chat.
 */
export function StudioNotificationBell({ className }: { className?: string }) {
    const [open, setOpen] = useState(false);
    // Opens a bit above half the screen; drag it up for all of it, or down to close.
    const [snap, setSnap] = useState<number | string | null>(SNAPS[0]);
    const waiting = useNeedsYou();
    const count = waiting.length;

    return (
        <Drawer.Root repositionInputs={false}
            open={open}
            onOpenChange={(next) => { setOpen(next); if (next) setSnap(SNAPS[0]); }}
            snapPoints={[...SNAPS]}
            activeSnapPoint={snap}
            setActiveSnapPoint={setSnap}
            fadeFromIndex={0}
        >
            <Drawer.Trigger asChild>
                <button
                    type="button"
                    aria-label={count ? `Notifications, ${count} need you` : "Notifications"}
                    className={cn("relative flex shrink-0 items-center justify-center rounded-full border border-border/60", className)}
                >
                    <BellIcon size={20} />
                    {count > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[9px] font-semibold leading-none text-white">
                            {count > 9 ? "9+" : count}
                        </span>
                    )}
                </button>
            </Drawer.Trigger>
            <Drawer.Portal>
                <Drawer.Overlay className={`fixed inset-0 z-50 bg-black/40 ${SHEET_OVERLAY_PHONE_ONLY}`} />
                <Drawer.Content className={`dashboard-theme fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[calc(100svh-env(safe-area-inset-top)-0.75rem)] max-w-md lg:left-[var(--studio-sidebar,0px)] flex-col rounded-t-3xl border-t border-border/60 bg-background font-sans text-foreground outline-none ${SHEET_AS_PAGE}`}>
                    <SheetPageBack />
                    <div className="flex justify-center pt-3">
                        <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" />
                    </div>
                    <div className="px-4 pt-3">
                        <Drawer.Title className="text-center text-[15px] font-semibold">Notifications</Drawer.Title>
                        <Drawer.Description className="sr-only">What needs your attention, by category.</Drawer.Description>
                    </div>
                    {/* Scrolls only at full height, so a drag on the list moves the sheet until then. */}
                    <div className={cn("min-h-0 flex-1 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4", snap === 1 ? "overflow-y-auto" : "overflow-hidden")}>
                        {/* Push notifications off on this device: the way to turn them on comes first. */}
                        <StudioNotificationsCard className="mb-4 mt-0" />
                        {count === 0 ? (
                            <div className="flex flex-col items-center rounded-3xl bg-muted/60 px-6 py-10 text-center">
                                <ChatRoundCheckIcon size={36} className="mb-2" />
                                <p className="text-[15px] font-semibold">You&apos;re all caught up</p>
                                <p className="mt-1 text-sm leading-6 text-muted-foreground">Your assistant is handling every chat.</p>
                            </div>
                        ) : (
                            <section>
                                <h2 className="mb-2 text-[15px] font-semibold">Needs you</h2>
                                <ul className="overflow-hidden rounded-2xl border border-orange-200 bg-orange-50/60 dark:border-orange-500/20 dark:bg-orange-500/5">
                                    {waiting.map((conversation) => (
                                        <li key={conversation.id} className="border-b border-orange-200 last:border-0 dark:border-orange-500/20">
                                            <StudioLink href={`/inbox/${conversation.id}`} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3">
                                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-600" />
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-baseline justify-between gap-2">
                                                        <span className="truncate text-[15px] font-semibold">{conversation.name}</span>
                                                        <span className="shrink-0 text-xs text-muted-foreground">{shortTime(conversation.needs_owner?.at ?? conversation.updated_at)}</span>
                                                    </span>
                                                    <span className="mt-0.5 block line-clamp-2 text-[13px] leading-5 text-foreground/80">
                                                        {conversation.owner_active ? "You're replying in this chat." : conversation.needs_owner?.reason}
                                                    </span>
                                                </span>
                                            </StudioLink>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

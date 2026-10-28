"use client";

import { useEffect, useRef, useState } from "react";
import { StudioLoadError } from "@/components/studio/studio-data";
import { StudioLink, useStudioNavigate } from "@/components/studio/studio-nav";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ChevronLeft, MailWarning } from "lucide-react";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { CHANNEL_LABEL, initials, useConversation, useConversationAction, useMarkRead } from "@/components/studio/useInbox";
import { useStudio } from "@/components/studio/StudioShell";
import { Skeleton } from "@/components/ui/skeleton";

function dayLabel(iso: string): string {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** One conversation: the customer on the left, the assistant on the right. */
export default function StudioConversationPage({ id }: { id: string }) {
    const query = useConversation(id);
    const act = useConversationAction(id);
    const conversation = query.data?.conversation;
    const messages = query.data?.messages ?? [];
    const reply = query.data?.reply;
    const [draft, setDraft] = useState("");
    const endRef = useRef<HTMLDivElement>(null);
    const navigate = useStudioNavigate();
    const queryClient = useQueryClient();
    const { project } = useStudio();
    const markRead = useMarkRead();
    // Opening the chat read it: the list and the tab badge catch up.
    const loaded = !!query.data;
    useEffect(() => {
        if (loaded) void queryClient.invalidateQueries({ queryKey: ["studio-inbox", project.id] });
    }, [loaded, project.id, queryClient]);
    const keepUnread = () => markRead.mutate({ id, read: false }, { onSuccess: () => navigate("/inbox") });
    const send = () => {
        const text = draft.trim();
        if (!text || act.isPending) return;
        act.mutate({ action: "reply", text }, { onSuccess: () => setDraft("") });
    };

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "end" });
    }, [messages.length]);

    return (
        <div className="flex min-h-svh flex-col">
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/60 bg-background/95 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
                <StudioLink href="/inbox" aria-label="Back to Inbox" className="flex h-10 w-10 items-center justify-center rounded-full">
                    <ChevronLeft className="h-5 w-5" />
                </StudioLink>
                {conversation ? (
                    <>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials(conversation.name)}</span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-semibold">{conversation.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{CHANNEL_LABEL[conversation.channel]}{conversation.number && conversation.number !== conversation.name ? ` · ${conversation.number}` : ""}</p>
                        </div>
                        <button type="button" onClick={keepUnread} disabled={markRead.isPending} aria-label="Mark as unread" title="Mark as unread" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground disabled:opacity-50">
                            <MailWarning className="h-5 w-5" />
                        </button>
                    </>
                ) : (
                    <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
                )}
            </header>

            {conversation && (conversation.owner_active || conversation.needs_owner) && (
                <div className={conversation.owner_active ? "bg-orange-50 px-4 py-2.5 text-[13px] font-medium text-orange-800 dark:bg-orange-500/10 dark:text-orange-300" : "bg-orange-50 px-4 py-2.5 text-[13px] text-orange-900 dark:bg-orange-500/10 dark:text-orange-200"}>
                    {conversation.owner_active
                        ? "You're replying. The assistant is paused in this chat."
                        : <><span className="font-semibold">Needs you:</span> {conversation.needs_owner!.reason}</>}
                </div>
            )}

            <div className="flex-1 px-4 py-4">
                {query.isLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-12 w-3/4 rounded-2xl" />
                        <Skeleton className="ml-auto h-20 w-4/5 rounded-2xl" />
                    </div>
                ) : !query.data ? (
                    <StudioLoadError error={query.error} fallback="Couldn't load this chat." onRetry={() => void query.refetch()} className="mt-0" />
                ) : messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {messages.map((message, index) => {
                            const newDay = index === 0 || dayLabel(messages[index - 1].at) !== dayLabel(message.at);
                            return (
                                <div key={message.id} className="flex flex-col">
                                    {newDay && <p className="mx-auto my-2 text-xs text-muted-foreground">{dayLabel(message.at)}</p>}
                                    {message.from === "customer" ? (
                                        <div className="max-w-[82%] self-start rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-[15px] leading-6">{message.text}</div>
                                    ) : message.from === "owner" ? (
                                        <div className="max-w-[85%] self-end">
                                            <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-foreground px-3.5 py-2.5 text-[15px] leading-6 text-background">{message.text}</div>
                                            <p className="mr-1 mt-1 text-right text-[11px] text-muted-foreground">
                                                You · {new Date(message.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="max-w-[85%] self-end">
                                            <div className="rounded-2xl rounded-br-md bg-violet-50 px-3.5 py-2.5 text-[15px] leading-6 dark:bg-violet-500/15">
                                                <MarkdownRenderer content={message.text} className="text-[15px] leading-6 [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0" />
                                            </div>
                                            <p className="mr-1 mt-1 text-right text-[11px] text-muted-foreground">
                                                Assistant · {new Date(message.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                <div ref={endRef} />
            </div>

            <div className="sticky bottom-[var(--keyboard,0px)] border-t border-border/60 bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 transition-[bottom] duration-200 [html[data-keyboard]_&]:pb-3">
                {act.error && <p role="alert" className="mb-2 text-[13px] leading-5 text-destructive">{act.error.message}</p>}
                {!conversation || !reply ? null : reply.reason === "website" ? (
                    <p className="text-[13px] leading-5 text-muted-foreground">Your assistant is handling this chat. Replying yourself works on WhatsApp, website and link chats.</p>
                ) : conversation.owner_active ? (
                    <>
                        {reply.possible ? (
                            <form onSubmit={(event) => { event.preventDefault(); send(); }} className="flex items-end gap-2">
                                <label className="flex min-h-12 flex-1 items-center rounded-3xl bg-muted px-4 py-2">
                                    <span className="sr-only">Message {conversation.name}</span>
                                    <textarea
                                        value={draft}
                                        onChange={(event) => setDraft(event.target.value)}
                                        rows={1}
                                        placeholder={`Message ${conversation.name}…`}
                                        className="max-h-32 w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
                                    />
                                </label>
                                <button type="submit" disabled={!draft.trim() || act.isPending} aria-label="Send" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40">
                                    <ArrowUp className="h-5 w-5" />
                                </button>
                            </form>
                        ) : (
                            <p className="text-[13px] leading-5 text-muted-foreground">WhatsApp only lets businesses reply within 24 hours of the customer&apos;s last message. Call them, or wait for them to message again.</p>
                        )}
                        {reply.possible && conversation.channel !== "whatsapp" && (
                            <p className="mt-2 text-[12px] leading-4 text-muted-foreground">They&apos;ll see your messages while the chat is open on their screen.</p>
                        )}
                        <button type="button" onClick={() => act.mutate({ action: "hand_back" })} disabled={act.isPending} className="mt-2 h-11 w-full rounded-full border border-border/60 text-sm font-medium">
                            Hand back to the assistant
                        </button>
                    </>
                ) : (
                    <>
                        <p className="mb-2.5 text-[13px] leading-5 text-muted-foreground">
                            {conversation.needs_owner ? "The assistant is waiting for you." : "Your assistant is handling this chat."} Step in to reply yourself; it pauses here until you hand back, or 30 minutes after your last message.
                        </p>
                        <button type="button" onClick={() => act.mutate({ action: "step_in" })} disabled={act.isPending} className="h-12 w-full rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-60">
                            Step in and reply
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

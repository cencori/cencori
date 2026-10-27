"use client";

import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import { PlaygroundSheet, usePhone } from "./PlaygroundSheet";
import { PanelLeftIcon, Trash2, Plus, LogIn, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlaygroundSession } from "@/lib/playground-history";
import { TAB_BAR_START_SLOT_ID, tabBarButtonClass, useTabBarSlot } from "@/components/dashboard/MobileTabBar";

interface PlaygroundSidebarProps {
    sessions: PlaygroundSession[];
    activeSessionId: string | null;
    onSelect: (session: PlaygroundSession) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
    showSignupPrompt?: boolean;
}

// Compact age, as in Copilot's Recent chats: "48m", "20h", "3d", "2w", "Oct 5".
function timeAgo(timestamp: number): string {
    const minutes = Math.round((Date.now() - timestamp) / 60000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.round(days / 7);
    if (weeks < 5) return `${weeks}w`;
    return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PlaygroundSidebar({
    sessions,
    activeSessionId,
    onSelect,
    onNew,
    onDelete,
    showSignupPrompt = false,
}: PlaygroundSidebarProps) {
    // Open state lives here, not in the chat, so opening it never re-renders
    // the conversation (that made the sheet stutter).
    const [open, setOpen] = useState(false);
    const onToggle = () => setOpen((prev) => !prev);
    // Phones in the console: the toggle lives in the pill, and the history
    // comes up as a sheet from below, like the navigation menu.
    const pillSlot = useTabBarSlot(TAB_BAR_START_SLOT_ID);
    const phone = usePhone();
    const asSheet = !!pillSlot && phone;
    // Picking a chat (or starting one) puts the sheet away.
    const pick = (action: () => void) => () => {
        action();
        if (asSheet) setOpen(false);
    };

    const body = showSignupPrompt ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted/50">
                <LogIn className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div>
                <p className="text-sm font-medium text-foreground">Sign in to save chat history</p>
                <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
                    Your conversations are stored locally. Create an account to keep them across devices.
                </p>
            </div>
            <Button asChild size="sm" className="h-8 text-xs mt-1">
                <Link href="/signup">Sign up free</Link>
            </Button>
        </div>
    ) : (
        // Styled like Copilot's sub-menu: New chat, then Recent chats.
        <div className="-mx-2 flex flex-col gap-0.5">
            <button
                type="button"
                onClick={pick(onNew)}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
                <Plus className="h-4 w-4" />
                New chat
            </button>
            {sessions.length > 0 && (
                <>
                    <p className="mt-4 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Recent chats</p>
                    <ul className="flex flex-col gap-0.5">
                        {sessions.map((session) => (
                            <li
                                key={session.id}
                                className={cn(
                                    "group flex h-9 items-center gap-1 rounded-md pr-1 transition-colors hover:bg-muted",
                                    session.id === activeSessionId && "bg-muted",
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={pick(() => onSelect(session))}
                                    aria-current={session.id === activeSessionId}
                                    className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 pl-2 text-left"
                                >
                                    <span className="min-w-0 flex-1 truncate text-sm">{session.title || "Untitled"}</span>
                                    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{timeAgo(session.updatedAt)}</span>
                                </button>
                                {/* Beside the age, never on top of it. Touch has no hover, so the sheet always shows it. */}
                                <button
                                    type="button"
                                    onClick={() => onDelete(session.id)}
                                    className={cn(
                                        "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-red-500",
                                        asSheet ? "" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
                                    )}
                                    aria-label={`Delete ${session.title || "chat"}`}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );

    return (
        <>
            {pillSlot && createPortal(
                <button
                    type="button"
                    onClick={onToggle}
                    // Open, it becomes its close button, like the menu's.
                    className={tabBarButtonClass}
                    aria-label={open ? "Close chat history" : "Chat history"}
                    aria-expanded={open}
                >
                    {open ? <X className="h-4 w-4" /> : <PanelLeftIcon className="h-4 w-4" />}
                </button>,
                pillSlot,
            )}
            <button
                type="button"
                onClick={onToggle}
                className={cn(
                    pillSlot && "max-lg:hidden",
                    "absolute left-4 top-4 md:top-1/2 md:-translate-y-1/2 z-50 flex items-center justify-center h-9 w-9 rounded-full border shadow-md transition-all cursor-pointer",
                    open
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-muted-foreground/70 border-border/40 hover:text-foreground hover:border-border/60"
                )}
                title="Chat history"
            >
                <PanelLeftIcon className="h-4 w-4" />
            </button>
            {open && !asSheet && (
                <div className="absolute left-[calc(1rem+2.25rem+0.75rem)] top-4 md:top-1/2 md:-translate-y-1/2 z-50 w-72 max-h-[75vh] rounded-2xl border border-border/40 bg-popover/95 backdrop-blur-xl shadow-2xl p-4 flex flex-col gap-3 overflow-y-auto animate-in fade-in slide-in-from-left-2 duration-150">
                    {body}
                </div>
            )}
            {pillSlot && (
                <PlaygroundSheet open={open && asSheet} onOpenChange={(next) => { if (!next) setOpen(false); }} title="Chat history" description="Your past playground chats.">
                    {body}
                </PlaygroundSheet>
            )}
        </>
    );
}

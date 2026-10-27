"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import AirdropIcon from "@hugeicons/core-free-icons/AirdropIcon";
import { Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileTabBarProps {
    onCopilot?: () => void;
    onSearch: () => void;
    onMenu: () => void;
    /** The navigation sheet is open: the menu button becomes its close button. */
    menuOpen?: boolean;
    /**
     * "bottom": floating at the foot of the screen. "top": in the flow under
     * the profile bar, for pages whose composer owns the bottom (the playground).
     */
    position?: "bottom" | "top";
}

// Every round button in the pill sits in its own outlined circle.
const circle =
    "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border/60 text-foreground transition-[background-color,transform] hover:bg-secondary/70 active:scale-95";

/** For a page's own buttons in the pill. */
export const tabBarButtonClass = circle;

// Where a page puts its own buttons in the pill: before Copilot, and before
// the menu (the playground's chat history and model settings).
export const TAB_BAR_START_SLOT_ID = "mobile-tab-bar-start";
export const TAB_BAR_END_SLOT_ID = "mobile-tab-bar-end";

/**
 * The pill's slot, once it's on screen; null where there's no pill (the
 * public playground), so the page keeps its own buttons there.
 */
export function useTabBarSlot(id: string): HTMLElement | null {
    const [slot, setSlot] = useState<HTMLElement | null>(null);
    useEffect(() => setSlot(document.getElementById(id)), [id]);
    return slot;
}

/**
 * Floating pill at the bottom of the screen on phones: Copilot on the left,
 * search in the middle, the navigation menu on the right. Replaces the
 * buttons that used to sit in the top bar.
 *
 * It stays above the navigation sheet while that is open. The sheet closes on
 * any pointer-down outside it, so the pill keeps its pointer-downs to itself
 * and each button decides what happens to the sheet.
 */
export function MobileTabBar({ onCopilot, onSearch, onMenu, menuOpen = false, position = "bottom" }: MobileTabBarProps) {
    return (
        <nav
            aria-label="Quick actions"
            onPointerDown={(event) => event.stopPropagation()}
            className={cn(
                "pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 bg-background/85 backdrop-blur-md lg:hidden",
                // Only the floating one needs a shadow to lift it off the page.
                // Under the profile bar it's as tall as that bar: 32px buttons
                // (Find keeps its minimum width).
                position === "bottom"
                    ? "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 p-1.5 shadow-lg shadow-black/20"
                    : "relative mx-auto mt-3 w-fit shrink-0 p-1 [&_button]:h-8 [&_button]:w-8 [&_svg]:size-3.5",
                menuOpen ? "z-[60]" : "z-40",
            )}
        >
            <div id={TAB_BAR_START_SLOT_ID} className="flex items-center gap-1 empty:hidden" />
            {onCopilot && (
                <button
                    type="button"
                    onClick={onCopilot}
                    className={circle}
                    aria-label="Open Copilot"
                >
                    <HugeiconsIcon icon={AirdropIcon} className="h-4 w-4" />
                </button>
            )}
            <button
                type="button"
                onClick={onSearch}
                className="flex h-10 min-w-32 cursor-pointer items-center gap-2 rounded-full bg-secondary/60 px-4 text-sm text-muted-foreground transition-[background-color,transform] hover:bg-secondary active:scale-[0.98]"
                aria-label="Search"
            >
                <Search className="h-4 w-4" />
                Find
            </button>
            <div id={TAB_BAR_END_SLOT_ID} className="flex items-center gap-1 empty:hidden" />
            <button
                type="button"
                onClick={onMenu}
                className={circle}
                aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={menuOpen}
            >
                {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
        </nav>
    );
}

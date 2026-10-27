"use client";

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
}

const circle =
    "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-[background-color,transform] active:scale-95";

/**
 * Floating pill at the bottom of the screen on phones: Copilot on the left,
 * search in the middle, the navigation menu on the right. Replaces the
 * buttons that used to sit in the top bar.
 *
 * It stays above the navigation sheet while that is open. The sheet closes on
 * any pointer-down outside it, so the pill keeps its pointer-downs to itself
 * and each button decides what happens to the sheet.
 */
export function MobileTabBar({ onCopilot, onSearch, onMenu, menuOpen = false }: MobileTabBarProps) {
    return (
        <nav
            aria-label="Quick actions"
            onPointerDown={(event) => event.stopPropagation()}
            className={cn(
                "pointer-events-auto fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border/60 bg-background/85 p-1.5 shadow-lg shadow-black/20 backdrop-blur-md lg:hidden",
                menuOpen ? "z-[60]" : "z-40",
            )}
        >
            {onCopilot && (
                <button
                    type="button"
                    onClick={onCopilot}
                    className={cn(circle, "border border-border/60 hover:bg-secondary/70")}
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
            <button
                type="button"
                onClick={onMenu}
                className={cn(circle, "hover:bg-secondary/70")}
                aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={menuOpen}
            >
                {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
        </nav>
    );
}

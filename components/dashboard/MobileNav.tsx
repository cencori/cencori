"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileNavProps {
    onMenuClick: () => void;
}

export function MobileNav({ onMenuClick }: MobileNavProps) {
    return (
        <div className="sticky top-12 z-40 lg:hidden border-b border-zinc-100 dark:border-zinc-800 bg-sidebar px-4 h-12 flex items-center gap-3">
            <Button
                variant="ghost"
                size="icon"
                onClick={onMenuClick}
                className="h-8 w-8"
                aria-label="Open navigation menu"
            >
                <Menu className="h-5 w-5" />
            </Button>

            {/* Future: Add feedback button, notifications, etc. */}
            <div className="flex items-center gap-2 ml-auto">
                {/* Extensible space for future features */}
            </div>
        </div>
    );
}

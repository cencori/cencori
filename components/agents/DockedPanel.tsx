"use client";

import type { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/**
 * A side panel docked like Preview: below the top bar, Preview's width and
 * edge, no backdrop or slide, the page stays usable, and it only closes from
 * its own buttons or Escape. Focus starts on the first text field.
 */
export function DockedPanel({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
    return (
        <Sheet modal={false} open={open} onOpenChange={onOpenChange}>
            <SheetContent
                showOverlay={false}
                onInteractOutside={(event) => event.preventDefault()}
                className="top-[calc(var(--maintenance-banner-height,0px)+3rem)] bottom-0 h-auto w-full gap-0 border-border/40 shadow-none animate-none! transition-none! sm:max-w-none lg:w-[380px] xl:w-[420px]"
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    (event.target as HTMLElement | null)?.querySelector<HTMLElement>("input:not([readonly]):not([disabled]), textarea")?.focus();
                }}
            >
                {children}
            </SheetContent>
        </Sheet>
    );
}

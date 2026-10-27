"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Drawer } from "vaul";

/** Below the desktop breakpoint, where the playground's panels become sheets. */
export function usePhone(): boolean {
    const [phone, setPhone] = useState(false);
    useEffect(() => {
        const query = window.matchMedia("(max-width: 1023px)");
        const update = () => setPhone(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);
    return phone;
}

/**
 * The playground's panels on phones (chat history, model settings): half a
 * screen from below, like the navigation menu, with nothing dimmed behind it.
 * A tap outside or a swipe down closes it.
 */
export function PlaygroundSheet({
    open,
    onOpenChange,
    title,
    description,
    children,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-50 bg-transparent lg:hidden" />
                <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[50svh] flex-col rounded-t-2xl border-t border-border/60 bg-background outline-none lg:hidden">
                    <Drawer.Title className="sr-only">{title}</Drawer.Title>
                    <Drawer.Description className="sr-only">{description}</Drawer.Description>
                    <div aria-hidden="true" className="mx-auto mt-3 mb-1 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/40" />
                    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                        {children}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

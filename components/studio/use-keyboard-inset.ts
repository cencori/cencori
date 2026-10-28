"use client";

import { useEffect } from "react";

/**
 * Studio's keyboard, as a native app has it: the keyboard covers the page,
 * and what's being typed in sits on top of it. This keeps `--keyboard` on the
 * page (how much of the screen the keyboard covers, 0px without one) and
 * `data-keyboard` while it's up, from the visual viewport (what's above the
 * keyboard) on iPhone and Android alike. Sheets sit on `--keyboard` (see
 * globals.css), and a field tapped in a sheet is scrolled into view above it.
 */
export function useKeyboardInset(): void {
    useEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return;
        const root = document.documentElement;
        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                // The layout bottom minus the visible bottom: what the keyboard hides.
                const inset = Math.max(0, Math.round(window.innerHeight - (viewport.height + viewport.offsetTop)));
                const up = inset > 80;
                root.style.setProperty("--keyboard", `${up ? inset : 0}px`);
                if (up) root.setAttribute("data-keyboard", "");
                else root.removeAttribute("data-keyboard");
            });
        };
        // A field in a sheet: once the keyboard is up, scroll the sheet so it's in view.
        const onFocus = (event: FocusEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target?.matches("input, textarea, [contenteditable]") || !target.closest("[data-vaul-drawer]")) return;
            window.setTimeout(() => target.scrollIntoView({ block: "nearest", behavior: "smooth" }), 320);
        };
        update();
        viewport.addEventListener("resize", update);
        viewport.addEventListener("scroll", update);
        document.addEventListener("focusin", onFocus);
        return () => {
            cancelAnimationFrame(frame);
            viewport.removeEventListener("resize", update);
            viewport.removeEventListener("scroll", update);
            document.removeEventListener("focusin", onFocus);
            root.style.removeProperty("--keyboard");
            root.removeAttribute("data-keyboard");
        };
    }, []);
}

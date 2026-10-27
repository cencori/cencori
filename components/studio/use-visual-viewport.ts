"use client";

import { useEffect, useState } from "react";

/**
 * The part of the screen the person can actually see: on a phone, what's
 * above the keyboard. iOS doesn't shrink the page for the keyboard (100dvh
 * stays the same), so a chat that should keep its top in view and its input
 * on the keyboard sizes itself from this instead. `keyboard` is true while a
 * keyboard (or anything like it) covers the bottom.
 */
export function useVisualViewport(): { height: number | null; offsetTop: number; keyboard: boolean } {
    const [state, setState] = useState<{ height: number | null; offsetTop: number; keyboard: boolean }>({ height: null, offsetTop: 0, keyboard: false });
    useEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return;
        const update = () => setState({
            height: viewport.height,
            offsetTop: viewport.offsetTop,
            keyboard: window.innerHeight - viewport.height > 120,
        });
        update();
        viewport.addEventListener("resize", update);
        viewport.addEventListener("scroll", update);
        return () => {
            viewport.removeEventListener("resize", update);
            viewport.removeEventListener("scroll", update);
        };
    }, []);
    return state;
}

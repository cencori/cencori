"use client";

import { useEffect, useId } from "react";

// Pages with edits that leaving would lose, so Copilot asks before taking
// the user somewhere else.
const unsaved = new Set<string>();

export const hasUnsavedChanges = () => unsaved.size > 0;

/** Marks this page as having unsaved edits while `dirty` holds. */
export function useUnsavedChanges(dirty: boolean) {
    const id = useId();
    useEffect(() => {
        if (!dirty) return;
        unsaved.add(id);
        return () => { unsaved.delete(id); };
    }, [dirty, id]);
}

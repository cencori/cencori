"use client";

import { useEffect } from "react";

/**
 * Radix portals (dropdowns, dialogs, selects, toasts…) mount at
 * `document.body`, outside any route subtree — so scope-gated `dark:`
 * utilities can never match them from a subtree class alone. Mirroring the
 * scope onto <body> while the layout is mounted keeps overlays themed.
 */
export function ThemeScope({ name }: { name: string }) {
  useEffect(() => {
    document.body.classList.add(name);
    return () => {
      document.body.classList.remove(name);
    };
  }, [name]);
  return null;
}

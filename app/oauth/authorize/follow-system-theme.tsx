"use client";

import { useLayoutEffect } from "react";

/**
 * Shows this page in the computer's own light or dark setting, whatever theme was last chosen in
 * the dashboard. A person arriving here from another product has not chosen a Cencori theme for
 * it. The dashboard's saved choice is left alone and put back on leaving the page.
 */
export function FollowSystemTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const before = { dark: root.classList.contains("dark"), light: root.classList.contains("light"), scheme: root.style.colorScheme };
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      // Only write when something differs, so the observer below does not answer itself.
      if (root.classList.contains("dark") !== system.matches) root.classList.toggle("dark", system.matches);
      if (root.classList.contains("light") === system.matches) root.classList.toggle("light", !system.matches);
      const scheme = system.matches ? "dark" : "light";
      if (root.style.colorScheme !== scheme) root.style.colorScheme = scheme;
    };
    apply();
    system.addEventListener("change", apply);
    // The theme provider puts the saved theme back when it starts, after this has run.
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "style"] });
    return () => {
      observer.disconnect();
      system.removeEventListener("change", apply);
      root.classList.toggle("dark", before.dark);
      root.classList.toggle("light", before.light);
      root.style.colorScheme = before.scheme;
    };
  }, []);
  return null;
}

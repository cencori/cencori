"use client";

import { useCallback, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Studio's own screens (Home, Inbox, a chat, Sales, Money, AI) switch in the
 * browser, never through the server: they open in a frame, even offline, and
 * only their data loads after. The address changes with history.pushState,
 * which Next.js keeps in step with usePathname, so the back button and shared
 * links still work. Setup and Get the app are ordinary pages, reached the
 * normal way. The screens themselves are drawn by StudioRouter.
 */

/** The Studio path, without the internal /studio-app prefix. */
export function useStudioPath(): string {
    return (usePathname() ?? "/").replace(/^\/studio-app(?=\/|$)/, "") || "/";
}

/** Whether a path is one of the screens this router draws. */
function isScreen(href: string): boolean {
    const path = href.split(/[?#]/)[0];
    return path === "/" || /^\/(inbox|sales|money|assistant)(\/|$)/.test(path);
}

/** Go to a Studio screen instantly (falls back to a normal page load for anything else). */
export function useStudioNavigate() {
    return useCallback((href: string, opts: { replace?: boolean } = {}) => {
        if (!isScreen(href)) {
            window.location.assign(href);
            return;
        }
        if (opts.replace) window.history.replaceState(null, "", href);
        else window.history.pushState(null, "", href);
        window.scrollTo(0, 0);
    }, []);
}

/** A link to a Studio screen that opens it instantly; other links behave as usual. */
export function StudioLink({ href, children, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) {
    const navigate = useStudioNavigate();
    if (!isScreen(href)) return <Link href={href} onClick={onClick} {...rest}>{children}</Link>;
    const open = (event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        // New tab, new window and the like stay with the browser.
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(href);
    };
    return <a href={href} onClick={open} {...rest}>{children}</a>;
}

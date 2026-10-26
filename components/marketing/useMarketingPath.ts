"use client";

import { usePathname, useSelectedLayoutSegments } from "next/navigation";

/**
 * The marketing page being shown, as a path on cencori.com. On the front-door
 * subdomains the URL bar drops the section (developers.cencori.com/apis is
 * /developers/apis), but the matched route keeps it, so read that there.
 */
export function useMarketingPath(): string {
    const visiblePath = usePathname() ?? "/";
    const segments = useSelectedLayoutSegments();
    const onFrontDoor = segments[0] === "developers" || segments[0] === "business";
    return onFrontDoor ? `/${segments.join("/")}` : visiblePath;
}

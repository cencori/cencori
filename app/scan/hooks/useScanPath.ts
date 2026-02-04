"use client";

import { useMemo } from "react";

/**
 * Hook to detect if we're on the scan subdomain and provide path utilities.
 * 
 * On scan.cencori.com:
 *   - scanPath("/import") returns "/import"
 *   - scanPath("/projects/123") returns "/projects/123"
 * 
 * On cencori.com:
 *   - scanPath("/import") returns "/scan/import"
 *   - scanPath("/projects/123") returns "/scan/projects/123"
 */
export function useScanPath() {
    const isSubdomain = useMemo(() => {
        if (typeof window === "undefined") return false;
        return window.location.hostname.startsWith("scan.");
    }, []);

    /**
     * Returns the correct path for scan routes based on current domain.
     * Pass paths WITHOUT the /scan prefix.
     * 
     * @param path - Path relative to scan root (e.g., "/import", "/projects/123", or "/" for home)
     * @returns Full path including /scan prefix if on main domain
     */
    const scanPath = (path: string): string => {
        // Handle root path
        if (path === "/" || path === "") {
            return isSubdomain ? "/" : "/scan";
        }
        // Ensure path starts with /
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        return isSubdomain ? normalizedPath : `/scan${normalizedPath}`;
    };

    return { isSubdomain, scanPath };
}

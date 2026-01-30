/**
 * Helper to generate correct paths for the scan app
 * On scan.cencori.com subdomain, paths should NOT include /scan prefix
 * On cencori.com main domain, paths should include /scan prefix
 */

export function getScanPath(path: string): string {
    // Path should already start with / but not with /scan
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // Check if we're on the subdomain (client-side only)
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'scan.cencori.com' || hostname === 'scan.localhost') {
            // On subdomain, don't add /scan prefix
            return normalizedPath;
        }
    }

    // On main domain or server-side, use /scan prefix
    return `/scan${normalizedPath}`;
}

/**
 * Get the base path for the scan app
 */
export function getScanBasePath(): string {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'scan.cencori.com' || hostname === 'scan.localhost') {
            return '';
        }
    }
    return '/scan';
}

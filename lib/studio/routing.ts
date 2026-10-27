/**
 * studio.cencori.com: the phone-first app for business owners. Its pages
 * live under app/studio-app and are served from the root of the subdomain
 * (studio.cencori.com/inbox → /studio-app/inbox). Sign-in, the auth callback
 * and the API stay where they are, so the shared session and every existing
 * endpoint work unchanged.
 */

export const STUDIO_INTERNAL_PREFIX = "/studio-app";

export function isStudioHostname(domain: string): boolean {
    const host = domain.split(":")[0].toLowerCase();
    return host === "studio.cencori.com" || host === "studio.localhost";
}

/** Paths Studio serves as they are: sign-in, its callback, password reset, the API. */
const PASS_THROUGH = ["/login", "/signup", "/auth", "/forgot", "/reset-password", "/api"];

export function isStudioPassThrough(pathname: string): boolean {
    return PASS_THROUGH.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** The internal page for a Studio URL, or null when it's served as it is. */
export function studioInternalPath(pathname: string): string | null {
    if (isStudioPassThrough(pathname)) return null;
    if (pathname === STUDIO_INTERNAL_PREFIX || pathname.startsWith(`${STUDIO_INTERNAL_PREFIX}/`)) return pathname;
    return pathname === "/" ? STUDIO_INTERNAL_PREFIX : `${STUDIO_INTERNAL_PREFIX}${pathname}`;
}

/** Studio's address for this environment (studio.localhost locally). */
export function studioOrigin(currentHostname: string): string {
    const host = currentHostname.split(":")[0].toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost")) {
        const port = currentHostname.split(":")[1];
        return `http://studio.localhost${port ? `:${port}` : ""}`;
    }
    return "https://studio.cencori.com";
}

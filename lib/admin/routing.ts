/**
 * admin.cencori.com: the internal panel. Its pages live under app/internal
 * and are served from the root of the subdomain (admin.cencori.com/revenue →
 * /internal/revenue). The API, sign-in and the team invite page pass through,
 * so the shared .cencori.com session and every endpoint work unchanged.
 * /internal/* on any other cencori host redirects here.
 */

export const ADMIN_INTERNAL_PREFIX = "/internal";

export function isAdminHostname(domain: string): boolean {
    const host = domain.split(":")[0].toLowerCase();
    return host === "admin.cencori.com" || host === "admin.localhost";
}

const PASS_THROUGH = ["/api", "/auth", "/login", "/signup", "/team-invite", "/forgot", "/reset-password"];

export function isAdminPassThrough(pathname: string): boolean {
    return PASS_THROUGH.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAdminInternalPath(pathname: string): boolean {
    return pathname === ADMIN_INTERNAL_PREFIX || pathname.startsWith(`${ADMIN_INTERNAL_PREFIX}/`);
}

/** The app/internal page for an admin-host URL, or null when it's served as it is. */
export function adminInternalPath(pathname: string): string | null {
    if (isAdminPassThrough(pathname)) return null;
    return pathname === "/" ? ADMIN_INTERNAL_PREFIX : `${ADMIN_INTERNAL_PREFIX}${pathname}`;
}

/** The admin-host URL path for an /internal path (/internal/revenue → /revenue). */
export function adminPublicPath(internalPath: string): string {
    return internalPath.slice(ADMIN_INTERNAL_PREFIX.length) || "/";
}

/**
 * The admin host for this environment, or null where there isn't one
 * (Brimble's *.brimble.app address, previews), which keep serving /internal.
 */
export function adminOrigin(currentHostname: string): string | null {
    const [hostPart, port] = currentHostname.toLowerCase().split(":");
    if (hostPart === "localhost" || hostPart.endsWith(".localhost")) {
        return `http://admin.localhost${port ? `:${port}` : ""}`;
    }
    if (hostPart === "cencori.com" || hostPart.endsWith(".cencori.com")) {
        return "https://admin.cencori.com";
    }
    return null;
}

/**
 * Link target inside the panel: clean on the admin host, prefixed where the
 * panel is still served under /internal. `currentPathname` is the address-bar
 * path (usePathname), which is the clean one on the admin host.
 */
export function adminHref(currentPathname: string, subPath: string): string {
    const clean = subPath === "" || subPath === "/" ? "/" : subPath.startsWith("/") ? subPath : `/${subPath}`;
    if (!isAdminInternalPath(currentPathname)) return clean;
    return clean === "/" ? ADMIN_INTERNAL_PREFIX : `${ADMIN_INTERNAL_PREFIX}${clean}`;
}

interface ResolveAuthRedirectOptions {
    currentOrigin?: string;
    fallbackOrigin?: string;
    defaultPath?: string;
}

export interface ResolvedAuthRedirect {
    oauthRedirectTo: string;
    navigationTarget: string;
}

function normalizeOrigin(value: string | undefined): string | null {
    if (!value) return null;
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}

/**
 * Public console destination for links whose intent is to enter the product.
 * Marketing pages use an absolute URL so auth and dashboard navigation begin
 * on the console host instead of briefly entering the main application host.
 */
export function getConsoleUrl(path = "/home", consoleOrigin?: string): string {
    const origin =
        normalizeOrigin(consoleOrigin) ??
        normalizeOrigin(process.env.NEXT_PUBLIC_CONSOLE_URL) ??
        (process.env.NODE_ENV === "development"
            ? "http://console.localhost:3000"
            : "https://console.cencori.com");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return new URL(normalizedPath, `${origin}/`).toString();
}

function isLocalhostHost(hostname: string): boolean {
    const normalized = hostname.toLowerCase();
    return (
        normalized === "localhost" ||
        normalized === "127.0.0.1" ||
        normalized === "::1" ||
        normalized.endsWith(".localhost")
    );
}

/**
 * Main-app hosts whose bare `/login` should start on the console host
 * instead, so the whole auth flow (form, callback, cookies) lives where the
 * session will be used. Product subdomains (scan, pitch, …) are untouched.
 */
function isMainAppHostname(hostname: string): boolean {
    const normalized = hostname.toLowerCase();
    return (
        normalized === "localhost" ||
        normalized === "127.0.0.1" ||
        normalized === "::1" ||
        normalized === "cencori.com" ||
        normalized === "www.cencori.com"
    );
}

function isConsoleHostname(hostname: string): boolean {
    const normalized = hostname.toLowerCase();
    return (
        normalized === "console.cencori.com" ||
        normalized === "console.localhost"
    );
}

/**
 * Absolute console origin for a main-app origin, or null when the current
 * host has no console counterpart (product subdomains, unknown hosts).
 * Port is preserved so local dev maps :3000 → console.localhost:3000.
 */
export function getConsoleOrigin(currentOrigin: string): string | null {
    let url: URL;
    try {
        url = new URL(currentOrigin);
    } catch {
        return null;
    }
    const hostname = url.hostname.toLowerCase();
    if (hostname === "cencori.com" || hostname === "www.cencori.com") {
        return "https://console.cencori.com";
    }
    if (isMainAppHostname(hostname)) {
        return `http://console.localhost${url.port ? `:${url.port}` : ""}`;
    }
    return null;
}

/**
 * Default post-login destination: `/home` when already on the console host,
 * the absolute console home when on a main-app host (session cookies are
 * shared via `.cencori.com` in prod; in dev the login itself must happen on
 * the console host, which the login page enforces), `/dashboard` elsewhere.
 */
export function getPostLoginDefault(currentOrigin: string): string {
    let hostname: string | null = null;
    try {
        hostname = new URL(currentOrigin).hostname;
    } catch {
        return "/dashboard";
    }
    if (isConsoleHostname(hostname)) return "/home";
    return getConsoleOrigin(currentOrigin)?.concat("/home") ?? "/dashboard";
}

function isAllowedAuthRedirectHost(hostname: string, currentHostname: string): boolean {
    const target = hostname.toLowerCase();
    const current = currentHostname.toLowerCase();

    if (target === current) return true;
    if (target === "cencori.com" || target.endsWith(".cencori.com")) return true;
    if (isLocalhostHost(target) && isLocalhostHost(current)) return true;

    return false;
}

function resolveBaseOrigin(options?: ResolveAuthRedirectOptions): string {
    const fromOption = normalizeOrigin(options?.currentOrigin);
    if (fromOption) return fromOption;

    if (typeof window !== "undefined") {
        const fromWindow = normalizeOrigin(window.location.origin);
        if (fromWindow) return fromWindow;
    }

    const fromFallback = normalizeOrigin(options?.fallbackOrigin);
    if (fromFallback) return fromFallback;

    const fromEnv = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
    if (fromEnv) return fromEnv;

    return "http://localhost:3000";
}

export function resolveAuthRedirectTargets(
    redirectParam: string | null,
    options?: ResolveAuthRedirectOptions
): ResolvedAuthRedirect {
    const baseOrigin = resolveBaseOrigin(options);
    const defaultPath = options?.defaultPath ?? "/dashboard";
    const fallbackUrl = new URL(
        defaultPath.startsWith("/") ? defaultPath : `/${defaultPath}`,
        baseOrigin
    );

    let resolved = fallbackUrl;

    if (redirectParam) {
        const raw = redirectParam.trim();
        if (raw.startsWith("/") && !raw.startsWith("//")) {
            resolved = new URL(raw, baseOrigin);
        } else {
            try {
                const candidate = new URL(raw);
                const baseHost = new URL(baseOrigin).hostname;
                if (isAllowedAuthRedirectHost(candidate.hostname, baseHost)) {
                    resolved = candidate;
                }
            } catch {
                // Ignore invalid redirect params and use fallback.
            }
        }
    }

    const baseUrl = new URL(baseOrigin);
    const sameOrigin = resolved.origin === baseUrl.origin;
    const navigationTarget = sameOrigin
        ? `${resolved.pathname}${resolved.search}${resolved.hash}`
        : resolved.toString();

    return {
        oauthRedirectTo: resolved.toString(),
        navigationTarget,
    };
}

/**
 * Destination for an already-signed-in visitor landing on /login or /signup.
 * Server-component safe (no window access). Honors a relative `?redirect=`
 * target, otherwise falls back to `fallback` (console home by default via
 * getPostLoginDefault at call sites). Auth pages themselves are never
 * valid targets — they would loop. Sub-paths like /signup/verify are left
 * untouched by callers (only exact /login and /signup should bounce).
 */
export function getSafeSignedInDestination(
    redirectParam: string | null | undefined,
    fallback = "/dashboard",
): string {
    if (!redirectParam) return fallback;
    const raw = redirectParam.trim();
    if (!raw) return fallback;
    if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
    try {
        const target = new URL(raw, "http://localhost");
        const pathname =
            target.pathname.length > 1 && target.pathname.endsWith("/")
                ? target.pathname.slice(0, -1)
                : target.pathname;
        if (pathname === "/login" || pathname === "/signup") return fallback;
        return `${target.pathname}${target.search}${target.hash}`;
    } catch {
        return fallback;
    }
}

/** True when the post-auth target would loop back onto an auth form. */
export function isAuthFormTarget(target: string): boolean {
    try {
        const url = new URL(
            target.startsWith("/") ? target : `/${target}`,
            "http://localhost",
        );
        const pathname =
            url.pathname.length > 1 && url.pathname.endsWith("/")
                ? url.pathname.slice(0, -1)
                : url.pathname;
        return (
            pathname === "/login" ||
            pathname === "/signup" ||
            pathname.startsWith("/login/") ||
            pathname.startsWith("/signup/")
        );
    } catch {
        return false;
    }
}

import { isStudioHostname } from "@/lib/studio/routing";


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
 * Strip single-use OAuth residue from a post-auth destination.
 *
 * When an unauthenticated request carrying `?code=` / `?token_hash=` (an
 * OAuth or email-link return that never reached `/auth/callback`) gets
 * bounced to `/login?redirect=<here>`, embedding the raw URL poisons every
 * retry: the dead code is single-use, so reusing it as the next `next`
 * guarantees another failure, and each bounce nests the residue deeper
 * (`/home?code=A` → `redirect=/home?code=A` → `next=/home?code=A` → …).
 *
 * Destinations never legitimately contain these keys — the callback consumes
 * them — so they are always safe to drop. Everything else (`token` for
 * invites, Tensor query, marketing UTMs) is preserved. `type`/`next`/`state`
 * ride along with the residue signature and are dropped only when a code is
 * present: `?next=` is meaningless outside the callback itself, and `state`
 * is also Tensor's own sign-in parameter. Dropping it unconditionally sent
 * everyone who had to log in first to "This sign-in link isn't valid".
 *
 * Accepts relative or absolute targets; returns the same shape (null in →
 * null out). Never invents a destination — worst case the bare path remains.
 */
export function sanitizeAuthRedirectTarget<T extends string | null | undefined>(target: T): T {
    if (!target) return target;
    const raw = target.trim();
    if (!raw) return target;
    const absolute = /^https?:\/\//i.test(raw);
    let url: URL;
    try {
        url = absolute ? new URL(raw) : new URL(raw, "http://localhost");
    } catch {
        return target;
    }
    const params = url.searchParams;
    const hasSingleUse = params.has("code") || params.has("token_hash");
    for (const key of ["code", "token_hash", "oauth_token", "error", "error_description", "error_code"]) {
        params.delete(key);
    }
    if (hasSingleUse) {
        params.delete("type");
        params.delete("next");
        params.delete("state");
    }
    // Nothing left but residue (e.g. "?code=X") — the path alone is the intent.
    if (absolute) return url.toString() as T;
    return `${url.pathname}${params.toString() ? `?${params.toString()}` : ""}${url.hash}` as T;
}

/**
 * Full post-auth destination pipeline for client navigations: sanitize
 * residue, resolve against the allowlist, then bounce console-only paths to
 * the console host. Server routes apply the same steps around
 * {@link resolveAuthRedirectTargets} directly.
 */
export function resolvePostAuthDestination(
    redirectParam: string | null | undefined,
    currentOrigin: string,
): string {
    const { navigationTarget } = resolveAuthRedirectTargets(
        sanitizeAuthRedirectTarget(redirectParam),
        { currentOrigin, defaultPath: getPostLoginDefault(currentOrigin) },
    );
    return getConsoleAwareNavigationTarget(navigationTarget, currentOrigin);
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
/**
 * On Studio, a relative post-auth target made absolute on Studio's host. The
 * OAuth return can come back through another host (Better Auth's base URL),
 * where a relative "/" would land on the console instead of Studio.
 * Anywhere else the target is returned unchanged.
 */
export function absoluteOnStudio(target: string, currentOrigin: string): string {
    try {
        const url = new URL(currentOrigin);
        if (isStudioHostname(url.hostname) && target.startsWith("/") && !target.startsWith("//")) return new URL(target, url.origin).toString();
    } catch {
        // Not a URL: leave the target as it is.
    }
    return target;
}

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
 * Console base URL for server-generated links (emails, Stripe return URLs,
 * checkout success URLs). Prefers the request's console counterpart so local
 * dev maps :3000 → console.localhost:3000, then NEXT_PUBLIC_CONSOLE_URL,
 * then the production console. Already-on-console origins are returned as-is.
 */
export function resolveConsoleBaseUrl(requestOrigin?: string): string {
    if (requestOrigin) {
        try {
            const url = new URL(requestOrigin);
            if (isConsoleHostname(url.hostname)) return url.origin;
            const counterpart = getConsoleOrigin(requestOrigin);
            if (counterpart) return counterpart;
        } catch {
            // Fall through to env/default.
        }
    }
    const fromEnv = normalizeOrigin(process.env.NEXT_PUBLIC_CONSOLE_URL);
    if (fromEnv) return fromEnv;
    return process.env.NODE_ENV === "development"
        ? "http://console.localhost:3000"
        : "https://console.cencori.com";
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
    // Studio (studio.cencori.com): its home is its own root, never the console.
    if (isStudioHostname(hostname)) return "/";
    return getConsoleOrigin(currentOrigin)?.concat("/home") ?? "/dashboard";
}

/**
 * Base URL for the OAuth callback (`/auth/callback`).
 *
 * The whole auth flow (form, callback, cookies) must live where the session
 * is used — the console host. When the form is rendered on a main-app host
 * (cencori.com, localhost), the callback itself must still be on the console
 * counterpart so Supabase returns there directly instead of bouncing through
 * the main host and losing the console destination.
 *
 * Product subdomains (scan, pitch, …) and unknown hosts have no console
 * counterpart and keep their own origin.
 */
export function getOAuthCallbackBase(currentOrigin: string): string {
    return getConsoleOrigin(currentOrigin) ?? currentOrigin;
}

/**
 * Absolute console `next` value for OAuth / email flows that have no explicit
 * `?redirect=` target.
 *
 * Unlike {@link getPostLoginDefault} (which is relative on console for
 * same-origin `router.push` navigation), this is always absolute on the
 * console host so the destination survives a host switch — e.g. Supabase
 * falling back to its Site URL (cencori.com) when the console callback URL
 * isn't allowlisted. A relative `/home` decoded on the main host would
 * otherwise resolve to `https://cencori.com/home` (a 404) instead of the
 * console home.
 */
export function getOAuthDefaultNext(currentOrigin: string): string {
    try {
        const url = new URL(currentOrigin);
        if (isConsoleHostname(url.hostname)) {
            return new URL("/home", url.origin).toString();
        }
        if (isStudioHostname(url.hostname)) {
            return new URL("/", url.origin).toString();
        }
    } catch {
        // Fall through to console resolution below.
    }
    return resolveConsoleBaseUrl(currentOrigin).concat("/home");
}

/**
 * Rewrite a post-auth destination that would otherwise strand the user on
 * the main site.
 *
 * When the OAuth callback lands on a main-app host (Supabase Site-URL
 * fallback, manually entered URL, stale bookmark) with a relative console
 * path such as `/home`, resolving it against the main origin keeps the user
 * on `cencori.com`. Console paths have no meaning there (`/home` is
 * reserved, not a marketing page), so bounce them to the console counterpart.
 * Absolute `https://cencori.com/home`-style targets are rewritten the same
 * way. Everything else passes through untouched.
 */
export function getConsoleAwareNavigationTarget(
    navigationTarget: string,
    currentOrigin: string,
): string {
    const consoleOrigin = getConsoleOrigin(currentOrigin);
    if (!consoleOrigin) return navigationTarget;

    const isRelative = navigationTarget.startsWith("/") && !navigationTarget.startsWith("//");
    let pathname: string | null = null;
    if (isRelative) {
        try {
            pathname = new URL(navigationTarget, "http://localhost").pathname;
        } catch {
            return navigationTarget;
        }
    } else {
        try {
            const candidate = new URL(navigationTarget);
            const currentHostname = new URL(currentOrigin).hostname.toLowerCase();
            if (candidate.hostname.toLowerCase() !== currentHostname) {
                return navigationTarget;
            }
            pathname = candidate.pathname;
        } catch {
            return navigationTarget;
        }
    }

    if (!pathname) return navigationTarget;
    // Console-only surfaces (no marketing equivalent on the main host).
    // Keep this list in sync with lib/console/routing.ts PROJECT_ROOTS /
    // ORGANIZATION_ROOTS. `/home` is the post-login default; the rest are
    // deep links that must not strand on cencori.com either.
    const CONSOLE_PATHS = new Set([
        "/home",
        "/agents",
        "/embedded-agents",
        "/observability",
        "/logs",
        "/ai-gateway",
        "/security",
        "/memory",
        "/deployments",
        "/monetization",
        "/revenue",
        "/copilot",
        "/webhooks",
        "/settings",
        "/projects",
        "/billing",
        "/usage",
        "/teams",
        "/audit-log",
        "/governance",
        "/organization",
    ]);
    const root = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
    const isConsolePath =
        pathname === "/home" ||
        pathname.startsWith("/home/") ||
        (CONSOLE_PATHS.has(root) &&
            // `/settings` on the main host is the account page; on console it
            // is the workspace settings — only bounce the exact console shape
            // plus its sub-paths, which is what this is.
            true);

    if (!isConsolePath) return navigationTarget;

    if (isRelative) {
        return new URL(navigationTarget, `${consoleOrigin}/`).toString();
    }
    try {
        const absolute = new URL(navigationTarget);
        const consoleUrl = new URL(consoleOrigin);
        absolute.protocol = consoleUrl.protocol;
        absolute.host = consoleUrl.host;
        return absolute.toString();
    } catch {
        return navigationTarget;
    }
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
    const defaultPath = (options?.defaultPath ?? "/dashboard").trim() || "/dashboard";
    // defaultPath is usually a relative path, but getPostLoginDefault() returns
    // an absolute console URL on main-app hosts — resolving that against
    // baseOrigin would produce garbage like /https://console… (this stranded
    // main-host callbacks on cencori.com). Absolute defaults stand on their own.
    let fallbackUrl: URL;
    if (/^https?:\/\//i.test(defaultPath)) {
        try {
            fallbackUrl = new URL(defaultPath);
        } catch {
            fallbackUrl = new URL("/dashboard", baseOrigin);
        }
    } else {
        fallbackUrl = new URL(
            defaultPath.startsWith("/") ? defaultPath : `/${defaultPath}`,
            baseOrigin
        );
    }

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

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isBetterAuthEnabled } from "@/lib/auth/flags";
import { resolvePublicOrigin } from "@/lib/public-origin";
import {
    getConsoleAwareNavigationTarget,
    resolveAuthRedirectTargets,
    getPostLoginDefault,
} from "@/lib/auth-redirect";

/**
 * Password sign-in, server-side.
 *
 * This used to call `signInWithPassword` in the browser, which meant the
 * session cookies were written with `document.cookie`. Safari's ITP caps the
 * lifetime of every script-written cookie at 7 days regardless of the 400-day
 * `maxAge` @supabase/ssr asks for — so mobile Safari users were silently
 * logged out roughly weekly, and no amount of cookie configuration could fix
 * it client-side. Cookies delivered by a `Set-Cookie` header are not capped.
 *
 * OAuth already went through the server for the same class of reason (see
 * app/auth/callback/route.ts); password login was the last path that didn't.
 *
 * The cookies stay `httpOnly: false` — that's the @supabase/ssr default and
 * the browser client has to be able to read them to hydrate the session.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

export async function POST(request: NextRequest) {
    // Not request.nextUrl: behind Brimble's proxy that is the container's own
    // http://localhost:8000, which would send sign-ins to console.localhost.
    const origin = resolvePublicOrigin(request);
    const { hostname } = new URL(origin);

    let email: string;
    let password: string;
    let redirectParam: string | null = null;
    try {
        const body = await request.json();
        email = String(body.email ?? "").trim();
        password = String(body.password ?? "");
        redirectParam = body.redirect ? String(body.redirect) : null;
    } catch {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    if (!email || !password) {
        return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    // Re-validate the destination server-side (open-redirect defense), same as
    // the OAuth callback does. Bounce console-only paths to the console host
    // so a main-host form submission still lands on console.cencori.com.
    const { navigationTarget: rawTarget } = resolveAuthRedirectTargets(redirectParam, {
        currentOrigin: origin,
        defaultPath: getPostLoginDefault(origin),
    });
    const navigationTarget = getConsoleAwareNavigationTarget(rawTarget, origin);

    if (isBetterAuthEnabled()) {
        return signInWithBetterAuth(request, email, password, navigationTarget);
    }

    const isProduction = hostname.endsWith("cencori.com");

    // Build the response first so the session cookies attach to it.
    const response = NextResponse.json({ redirectTo: navigationTarget });

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) =>
                    response.cookies.set(name, value, {
                        ...options,
                        domain: isProduction ? ".cencori.com" : undefined,
                        sameSite: "lax",
                        secure: isProduction,
                        path: "/",
                    }),
                );
            },
        },
    });

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.status ?? 400 },
        );
    }

    return response;
}

// Better Auth path (RFC-0001 cutover). Same contract as above: the session
// cookie arrives as a Set-Cookie header, and errors use the codes the login
// form already maps to friendly copy.
async function signInWithBetterAuth(
    request: NextRequest,
    email: string,
    password: string,
    navigationTarget: string,
): Promise<NextResponse> {
    const { auth } = await import("@/lib/auth/better-auth");
    const result = await auth.api.signInEmail({
        body: { email, password },
        headers: request.headers,
        asResponse: true,
    });

    if (!result.ok) {
        const body = await result.json().catch(() => ({}));
        const code = result.status === 429
            ? "over_request_rate_limit"
            : body?.code === "INVALID_EMAIL_OR_PASSWORD"
                ? "invalid_credentials"
                : body?.code;
        return NextResponse.json(
            { error: body?.message ?? "Unable to sign in.", code },
            { status: result.status },
        );
    }

    const response = NextResponse.json({ redirectTo: navigationTarget });
    for (const cookie of result.headers.getSetCookie()) {
        response.headers.append("set-cookie", cookie);
    }
    return response;
}

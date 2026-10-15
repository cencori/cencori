import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
    getConsoleAwareNavigationTarget,
    getConsoleOrigin,
    resolveAuthRedirectTargets,
    getPostLoginDefault,
} from "@/lib/auth-redirect";

// Mirrors @supabase/auth-js EmailOtpType (not re-exported by supabase-js).
type EmailOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

/**
 * OAuth / PKCE callback.
 *
 * Supabase's browser client uses the PKCE flow: the provider redirects back
 * with a `?code=` that must be exchanged for a session. Previously OAuth
 * redirected straight to a protected page (`/dashboard`) and relied on the
 * browser client's `detectSessionInUrl` to exchange the code — but the app
 * layout's client-side session guard (`getSession()` → `router.replace("/login")`)
 * raced that exchange and bounced users to /login, forcing a second OAuth pass.
 *
 * This route exchanges the code **server-side** and writes the session cookies
 * before redirecting on, so the session is present on the very first render of
 * the destination. `redirectTo` in the sign-in forms now points here.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

export async function GET(request: NextRequest) {
    const { searchParams, origin, hostname } = request.nextUrl;
    // OAuth / PKCE (email confirmation on the PKCE flow) uses `code`; email
    // templates using {{ .TokenHash }} use `token_hash` + `type`. Support both.
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const otpType = searchParams.get("type") as EmailOtpType | null;
    const oauthError = searchParams.get("error_description") || searchParams.get("error");

    // Re-validate the post-login destination server-side (open-redirect defense).
    // Then bounce console-only paths (e.g. relative `/home` when Supabase fell
    // back to its Site URL on the main host) to the console counterpart so
    // Google/GitHub sign-ins always land on console.cencori.com.
    const { navigationTarget: rawTarget } = resolveAuthRedirectTargets(searchParams.get("next"), {
        currentOrigin: origin,
        defaultPath: getPostLoginDefault(origin),
    });
    const navigationTarget = getConsoleAwareNavigationTarget(rawTarget, origin);

    // Error / missing-code redirects stay on the console host when the
    // callback itself ran on a main-app host — the bare main-host login
    // would immediately bounce to console anyway, but without preserving the
    // error query. Go direct so the message survives.
    const consoleOrigin = getConsoleOrigin(origin);
    const loginBase = consoleOrigin ?? origin;
    const loginWithError = (message: string) =>
        NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, loginBase));

    if (oauthError) {
        return loginWithError(oauthError);
    }
    if (!code && !(tokenHash && otpType)) {
        return NextResponse.redirect(new URL("/login", loginBase));
    }

    const isProduction = hostname.endsWith("cencori.com");
    const cookieDomain = isProduction ? ".cencori.com" : undefined;

    // Build the success redirect first so exchanged session cookies attach to it.
    const response = NextResponse.redirect(new URL(navigationTarget, origin));

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) =>
                    response.cookies.set(name, value, {
                        ...options,
                        domain: cookieDomain,
                        sameSite: "lax",
                        secure: isProduction,
                        path: "/",
                    }),
                );
            },
        },
    });

    const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({ type: otpType!, token_hash: tokenHash! });
    if (error) {
        return loginWithError(error.message);
    }

    return response;
}

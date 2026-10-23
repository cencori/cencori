import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { resolveAuthRedirectTargets } from "@/lib/auth-redirect";
import { isBetterAuthEnabled } from "@/lib/auth/flags";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

/**
 * Confirms the emailed 6-digit code and signs the new user in.
 *
 * The OTP used to be handed back to the browser as a raw `token` for the verify
 * page to redeem with `supabase.auth.verifyOtp(...)`. Two problems with that:
 * the resulting session cookies were written by `document.cookie`, which Safari
 * caps at 7 days no matter what maxAge we ask for — so a brand-new signup on
 * iPhone was already on a one-week timer — and a single-use auth credential was
 * travelling back down in a JSON body.
 *
 * The exchange now happens here and the session leaves as `Set-Cookie`, matching
 * app/api/auth/login/route.ts and app/auth/callback/route.ts. The token never
 * leaves the server.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, code, redirect: redirectParam, userId } = await req.json();
    const origin = req.nextUrl.origin;
    const { navigationTarget } = resolveAuthRedirectTargets(
      typeof redirectParam === "string" ? redirectParam : null,
      { currentOrigin: origin, defaultPath: "/onboarding" },
    );

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    if (isBetterAuthEnabled()) {
      return confirmWithBetterAuth(req, String(email), String(code), navigationTarget);
    }

    const admin = createAdminClient();

    const { data: records, error: fetchError } = await admin
      .from("verification_codes")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("code", code)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error("Error fetching verification code:", fetchError);
      return NextResponse.json({ error: "Failed to verify code" }, { status: 500 });
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const record = records[0];

    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: "Code expired" }, { status: 400 });
    }

    if (record.attempts >= 5) {
      return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 400 });
    }

    await admin
      .from("verification_codes")
      .update({ attempts: record.attempts + 1 })
      .eq("id", record.id);

    const targetUserId = userId || null;

    if (targetUserId) {
      const { error: updateError } = await admin.auth.admin.updateUserById(
        targetUserId,
        { email_confirm: true }
      );

      if (updateError) {
        console.error("Error confirming user email:", updateError);
        return NextResponse.json({ error: "Failed to verify email" }, { status: 500 });
      }
    }

    await admin
      .from("verification_codes")
      .update({ used_at: new Date().toISOString(), attempts: record.attempts + 1 })
      .eq("id", record.id);

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase(),
      options: { redirectTo: new URL(navigationTarget, origin).toString() },
    });

    // The email is verified either way; only the auto sign-in can fail from
    // here, so every fallback sends them to /login rather than erroring out.
    const signInFallback = NextResponse.json({
      success: true,
      redirectTo: `/login?redirect=${encodeURIComponent(navigationTarget)}`,
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("Error generating magic link:", linkError);
      return signInFallback;
    }

    const linkUrl = new URL(linkData.properties.action_link);
    const token = linkUrl.searchParams.get("token");

    if (!token) {
      console.error("No token in magic link");
      return signInFallback;
    }

    // Build the success response first so session cookies attach to it.
    const isProduction = req.nextUrl.hostname.endsWith("cencori.com");
    const response = NextResponse.json({ success: true, redirectTo: navigationTarget });

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
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

    const { error: signInError } = await supabase.auth.verifyOtp({
      email: email.toLowerCase(),
      token,
      type: "magiclink",
    });

    if (signInError) {
      console.error("Auto-login after verification failed:", signInError);
      return signInFallback;
    }

    return response;
  } catch (err) {
    console.error("Confirm verification code error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const OTP_ERRORS: Record<string, string> = {
  INVALID_OTP: "Invalid code",
  OTP_EXPIRED: "Code expired",
  TOO_MANY_ATTEMPTS: "Too many attempts. Request a new code.",
};

// Better Auth path (RFC-0001 cutover): verifying the email OTP marks the email
// verified and, with autoSignInAfterVerification, signs the user in; the
// session leaves as Set-Cookie, same as the Supabase path above.
async function confirmWithBetterAuth(
  req: NextRequest,
  email: string,
  code: string,
  navigationTarget: string,
): Promise<NextResponse> {
  const { auth } = await import("@/lib/auth/better-auth");
  const result = await auth.api.verifyEmailOTP({
    body: { email: email.toLowerCase(), otp: code },
    headers: req.headers,
    asResponse: true,
  });

  if (!result.ok) {
    const body = await result.json().catch(() => ({}));
    return NextResponse.json(
      { error: OTP_ERRORS[body?.code] ?? body?.message ?? "Failed to verify code" },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ success: true, redirectTo: navigationTarget });
  for (const cookie of result.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}

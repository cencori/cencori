import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { isBetterAuthEnabled } from "@/lib/auth/flags";
import { authBrandFor } from "@/lib/auth/brand";
import { withAuthBrand } from "@/lib/auth/brand-context";
import { sanitizeAuthRedirectTarget } from "@/lib/auth-redirect";

export async function POST(req: Request) {
  try {
    const { email, redirect } = await req.json();
    // A Tensor sign-in stays one: the email says Tensor, and the reset page leads back into it.
    const redirectTarget = typeof redirect === "string" ? sanitizeAuthRedirectTarget(redirect) : null;
    const brand = authBrandFor(redirectTarget);
    const resetPath =
      brand === "tensor" && redirectTarget
        ? `/reset-password?redirect=${encodeURIComponent(redirectTarget)}`
        : "/reset-password";

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Better Auth emails a one-time link (lib/email/password-reset-email.ts)
    // that lands on /reset-password?token=…. It answers the same whether or
    // not the account exists, so this can't be used to probe for emails.
    if (isBetterAuthEnabled()) {
      const { auth } = await import("@/lib/auth/better-auth");
      await withAuthBrand(brand, () =>
        auth.api.requestPasswordReset({
          body: { email: email.toLowerCase(), redirectTo: resetPath },
        }),
      );
      return NextResponse.json({ success: true });
    }

    const supabase = await createServerClient();

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });

    if (error) {
      console.error("Forgot password error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Forgot password API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

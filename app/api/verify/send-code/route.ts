import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { isBetterAuthEnabled } from "@/lib/auth/flags";
import { sendVerificationCodeEmail } from "@/lib/email/verification-code-email";
import { withAuthBrand } from "@/lib/auth/brand-context";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    const { email, userId, brand: askedBrand } = await req.json();
    // A Tensor sign-up gets a Tensor email (lib/email/verification-code-email.ts).
    const brand = askedBrand === "tensor" ? "tensor" : "cencori";

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Better Auth issues, stores (hashed) and emails the code itself through
    // its email OTP plugin, with the same email (lib/auth/better-auth.ts).
    if (isBetterAuthEnabled()) {
      const { auth } = await import("@/lib/auth/better-auth");
      await withAuthBrand(brand, () =>
        auth.api.sendVerificationOTP({
          body: { email: email.toLowerCase(), type: "email-verification" },
        }),
      );
      return NextResponse.json({ success: true });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const admin = createAdminClient();

    const { error: insertError } = await admin.from("verification_codes").insert({
      email: email.toLowerCase(),
      code,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error("Error storing verification code:", insertError);
      return NextResponse.json({ error: "Failed to send code" }, { status: 500 });
    }

    let greeting = "Hi there,";
    if (userId) {
      try {
        const { data: user } = await admin.auth.admin.getUserById(userId);
        const firstName = user?.user?.user_metadata?.first_name;
        if (firstName && typeof firstName === "string") {
          greeting = `Hi ${firstName},`;
        }
      } catch {
        // fall back to default greeting
      }
    }

    try {
      await sendVerificationCodeEmail({ to: email, code, greeting, brand });
    } catch (emailErr) {
      console.error("Failed to send verification email:", emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Send verification code error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

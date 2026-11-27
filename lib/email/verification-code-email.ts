import { SendByte } from "@sendbyte/node";

import type { AuthBrand } from "@/lib/auth/brand";
import { currentAuthBrand } from "@/lib/auth/brand-context";

// The 6-digit sign-up verification email. Shared by the Supabase-era
// /api/verify/send-code route and Better Auth's email OTP plugin
// (lib/auth/better-auth.ts) so both send the identical message.
// No-op when SENDBYTE_API_KEY is unset (local dev).
export async function sendVerificationCodeEmail(params: {
  to: string;
  code: string;
  greeting?: string;
  /** Whose sign-up this is; by default, the one the sending route said (lib/auth/brand-context.ts). */
  brand?: AuthBrand;
}): Promise<void> {
  const apiKey = process.env.SENDBYTE_API_KEY;
  if (!apiKey) return;

  const greeting = params.greeting ?? "Hi there,";
  const tensor = (params.brand ?? currentAuthBrand()) === "tensor";
  const sendbyte = new SendByte(apiKey);
  await sendbyte.emails.send({
    from: tensor ? "Tensor <system@send.cencori.com>" : "Cencori <system@send.cencori.com>",
    to: params.to,
    subject: tensor ? "Your Tensor verification code" : "Your verification code",
    html: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;color:#111;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#555;">${greeting}</p>
  <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#555;">Use the code below to verify your ${tensor ? "Tensor " : ""}account.</p>
  <div style="text-align:center;margin:32px 0;">
    <span style="display:inline-block;font-size:42px;font-weight:700;letter-spacing:12px;color:#111;background:#f5f5f5;padding:20px 28px;border-radius:8px;">${params.code}</span>
  </div>
  <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#999;">This code expires in 10 minutes. If you didn&rsquo;t request this, you can safely ignore this email.</p>
  <div style="margin-top:32px;padding-top:24px;border-top:1px solid #eee;">
    ${tensor ? TENSOR_FOOTER : CENCORI_FOOTER}
  </div>
</div>
</body>
</html>`,
  });
}

const CENCORI_FOOTER = `<p style="margin:0 0 12px;font-size:12px;color:#999;text-align:center;"><a href="https://cencori.com/docs" style="color:#888;text-decoration:underline;">Docs</a> &nbsp;&middot;&nbsp; <a href="https://cencori.com/newsroom" style="color:#888;text-decoration:underline;">Newsroom</a></p>
    <p style="margin:0 0 8px;font-size:12px;color:#999;text-align:center;">Making AI infrastructure accessible &mdash; so builders can build and scale with confidence.</p>
    <p style="margin:0 4px 0;font-size:11px;color:#aaa;text-align:center;">Cencori, Inc. &middot; San Francisco, CA</p>`;

/** Under a Tensor email: Tensor, and who runs its accounts. */
export const TENSOR_FOOTER = `<p style="margin:0 0 12px;font-size:12px;color:#999;text-align:center;"><a href="https://tensorade.app" style="color:#888;text-decoration:underline;">tensorade.app</a></p>
    <p style="margin:0 0 8px;font-size:12px;color:#999;text-align:center;">Tensor, secured by Cencori.</p>
    <p style="margin:0 4px 0;font-size:11px;color:#aaa;text-align:center;">Cencori, Inc. &middot; San Francisco, CA</p>`;

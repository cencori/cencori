import { SendByte } from "@sendbyte/node";

// Password reset email for Better Auth (lib/auth/better-auth.ts
// sendResetPassword). Supabase sent its own until the RFC-0001 cutover; this
// matches the verification-code email's sender and layout. No-op when
// SENDBYTE_API_KEY is unset (local dev).
export async function sendPasswordResetEmail(params: { to: string; url: string }): Promise<void> {
  const apiKey = process.env.SENDBYTE_API_KEY;
  if (!apiKey) return;

  const sendbyte = new SendByte(apiKey);
  await sendbyte.emails.send({
    from: "Cencori <system@send.cencori.com>",
    to: params.to,
    subject: "Reset your password",
    html: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;color:#111;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#555;">Hi there,</p>
  <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#555;">We received a request to reset the password for your Cencori account. Use the button below to choose a new one.</p>
  <div style="text-align:center;margin:32px 0;">
    <a href="${params.url}" style="display:inline-block;font-size:14px;font-weight:600;color:#fff;background:#111;padding:12px 24px;border-radius:8px;text-decoration:none;">Reset password</a>
  </div>
  <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#999;">This link expires in 1 hour. If you didn&rsquo;t request this, you can safely ignore this email; your password won&rsquo;t change.</p>
  <div style="margin-top:32px;padding-top:24px;border-top:1px solid #eee;">
    <p style="margin:0 0 12px;font-size:12px;color:#999;text-align:center;"><a href="https://cencori.com/docs" style="color:#888;text-decoration:underline;">Docs</a> &nbsp;&middot;&nbsp; <a href="https://cencori.com/newsroom" style="color:#888;text-decoration:underline;">Newsroom</a></p>
    <p style="margin:0 0 8px;font-size:12px;color:#999;text-align:center;">Making AI infrastructure accessible &mdash; so builders can build and scale with confidence.</p>
    <p style="margin:0 4px 0;font-size:11px;color:#aaa;text-align:center;">Cencori, Inc. &middot; San Francisco, CA</p>
  </div>
</div>
</body>
</html>`,
  });
}

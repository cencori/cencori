import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getBaseUrl } from "@/lib/newsletter";
import { verifyUserUnsubscribeToken } from "@/lib/user-unsubscribe";

/**
 * The unsubscribe link in emails to the Tensor waitlist (lib/email/tensor-launch.ts). The link
 * carries the entry's id and a token signed over it, so no sign-in is needed.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function unsubscribe(id: string | null, token: string | null): Promise<"done" | "invalid_token" | "server"> {
  if (!id || !token || !UUID.test(id) || !verifyUserUnsubscribeToken(`tensor-waitlist:${id}`, token)) {
    return "invalid_token";
  }
  const { error } = await createAdminClient()
    .from("tensor_waitlist")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", id)
    .is("unsubscribed_at", null);
  if (error) {
    console.error("[Tensor waitlist] Unsubscribe failed:", error.message);
    return "server";
  }
  return "done";
}

export async function GET(req: NextRequest) {
  const result = await unsubscribe(req.nextUrl.searchParams.get("id"), req.nextUrl.searchParams.get("token"));
  return NextResponse.redirect(
    `${getBaseUrl()}/subscribe/unsubscribed${result === "done" ? "" : `?error=${result}`}`,
  );
}

// One-click unsubscribe (RFC 8058): mail clients POST to the link with no body.
export async function POST(req: NextRequest) {
  const result = await unsubscribe(req.nextUrl.searchParams.get("id"), req.nextUrl.searchParams.get("token"));
  return result === "done"
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: result }, { status: result === "server" ? 500 : 400 });
}

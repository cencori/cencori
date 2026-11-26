import { after, NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { readTensorCloudConfig } from "@/lib/tensor-cloud";
import {
  receiveQualityEvent,
  sweepQualityInbox,
  takeUpComments,
  verifyQualitySignature,
  type QualityEvent,
} from "@/lib/tensor-quality-inbox";

/**
 * Quality's webhook: a new thread or reply on any Tensor project's published app
 * (lib/tensor-quality-inbox.ts). Registered once with scripts/quality-webhook.ts; its secret is
 * QUALITY_WEBHOOK_SECRET. Quality wants a 2xx within ten seconds and sends again until it gets
 * one, so the work happens after the answer.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.QUALITY_WEBHOOK_SECRET?.trim();
  // Unanswered, Quality keeps the event and tries again for two hours.
  if (!secret) return NextResponse.json({ error: "Not set up." }, { status: 503 });

  const raw = await request.text();
  if (!verifyQualitySignature(secret, request.headers.get("quality-signature"), raw)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }
  let event: QualityEvent;
  try {
    event = JSON.parse(raw) as QualityEvent;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  if (typeof event?.id !== "string" || typeof event.type !== "string") return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const cloud = readTensorCloudConfig();
  try {
    const received = await receiveQualityEvent(admin, event);
    if (received.kept && cloud) {
      after(() =>
        takeUpComments(admin, cloud, received.taskId).catch((error) =>
          console.error("[Tensor Quality] Acting on comments failed", error),
        ),
      );
    }
  } catch (error) {
    console.error("[Tensor Quality] Keeping a comment failed", error);
    // Not kept: Quality sends it again.
    return NextResponse.json({ error: "Try again." }, { status: 503 });
  }
  // Comments left waiting by a restart are taken up whenever Quality next says anything.
  if (cloud) after(() => sweepQualityInbox(admin, cloud).catch(() => undefined));
  return NextResponse.json({ ok: true });
}

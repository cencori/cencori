import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { runningBackgroundWork } from "@/lib/tensor-background-turn";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { busyWords } from "@/lib/tensor-busy-words";

/**
 * What Tensor is doing for this account with no page open (lib/tensor-background-turn.ts), or
 * null. A chat whose message has to wait for it says what for, and sends it when this is null.
 */
export async function GET(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return NextResponse.json({ error: "Your Cencori session is invalid." }, { headers: noStoreHeaders(), status: 401 });
  try {
    return NextResponse.json({ running: await runningBackgroundWork(session.admin, session.user.id) }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[Tensor Background] Reading running work failed", error);
    return NextResponse.json({ error: "Tensor could not read that." }, { headers: noStoreHeaders(), status: 503 });
  }
}

/**
 * The same, with what Tensor says to a message that has to wait for it (lib/tensor-busy-words.ts):
 * `{ message, project }` in, `{ running, words }` out. Words are null when they cannot be had in a
 * few seconds; the page then says something plain.
 */
export async function POST(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return NextResponse.json({ error: "Your Cencori session is invalid." }, { headers: noStoreHeaders(), status: 401 });
  let body: { message?: unknown; project?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "That request is invalid." }, { headers: noStoreHeaders(), status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  const project = typeof body.project === "string" ? body.project : null;
  try {
    const running = await runningBackgroundWork(session.admin, session.user.id);
    const words = message ? await busyWords(session.admin, { message, project, work: running }) : null;
    return NextResponse.json({ running, words }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[Tensor Background] Answering a waiting message failed", error);
    return NextResponse.json({ running: null, words: null }, { headers: noStoreHeaders() });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { runningBackgroundWork } from "@/lib/tensor-background-turn";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";

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

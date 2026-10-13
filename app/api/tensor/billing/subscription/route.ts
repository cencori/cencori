import { NextRequest, NextResponse } from "next/server";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { noStoreHeaders } from "@/lib/tensor-auth";

/**
 * Kept so a client that still asks gets an answer: a pass is one payment and nothing renews, so
 * there is never a subscription to report.
 */
export async function GET(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "Your Cencori session is invalid." },
      { headers: noStoreHeaders(), status: 401 },
    );
  }
  return NextResponse.json({ subscription: null }, { headers: noStoreHeaders() });
}

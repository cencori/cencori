import { NextRequest, NextResponse } from "next/server";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { noStoreHeaders } from "@/lib/tensor-auth";

/**
 * Kept so a client that still asks gets an answer: a pass is one payment and nothing renews, so
 * there is never anything to turn off.
 */
export async function POST(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "Your Cencori session is invalid." },
      { headers: noStoreHeaders(), status: 401 },
    );
  }
  return NextResponse.json(
    { error: "No auto-renewing subscription was found." },
    { headers: noStoreHeaders(), status: 404 },
  );
}

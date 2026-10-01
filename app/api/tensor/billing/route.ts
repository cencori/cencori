import { NextRequest, NextResponse } from "next/server";
import {
  authenticateTensorBillingRequest,
  getTensorBillingSnapshot,
} from "@/lib/tensor-billing";
import { noStoreHeaders } from "@/lib/tensor-auth";

export async function GET(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "Your Cencori session is invalid." },
      { headers: noStoreHeaders(), status: 401 },
    );
  }

  try {
    const snapshot = await getTensorBillingSnapshot(session.admin, session.user.id);
    return NextResponse.json(snapshot, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("[Tensor Billing] Snapshot failed", error);
    return NextResponse.json(
      { error: "Tensor billing is temporarily unavailable." },
      { headers: noStoreHeaders(), status: 503 },
    );
  }
}

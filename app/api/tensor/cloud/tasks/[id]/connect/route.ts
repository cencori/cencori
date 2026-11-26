import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { readTensorCloudConfig } from "@/lib/tensor-cloud";
import { connectSandbox } from "@/lib/tensor-cloud-connect";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/**
 * Hands the page what it needs to open a task: where the gateway is, and a ticket for it
 * (lib/tensor-cloud-connect.ts). The page asks again each time it connects.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const config = readTensorCloudConfig();
  if (!config) return json({ error: "Tensor on the web is not available yet." }, 503);

  try {
    const connection = await connectSandbox(session.admin, config, session.user.id, (await context.params).id);
    if (connection.ok) return json({ url: connection.url });
    return json({ error: connection.error, ...(connection.code ? { code: connection.code } : {}) }, connection.status);
  } catch (error) {
    console.error("[Tensor Cloud] Connecting to a task failed", error);
    return json({ error: "Tensor could not open this chat." }, 503);
  }
}

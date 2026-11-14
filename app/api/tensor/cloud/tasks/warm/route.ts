import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { FlyMachines, readTensorCloudConfig } from "@/lib/tensor-cloud";
import { readCloudAccess, warmSpare } from "@/lib/tensor-cloud-tasks";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/**
 * Starts the account's spare workspace. The page calls this when someone begins to type a new
 * chat, so that by the time they send, the machine is running and the agent is listening.
 *
 * A hint, never a requirement: with no spare, or nothing to start, it says so and the chat is
 * simply made the usual way.
 */
export async function POST(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const config = readTensorCloudConfig();
  if (!config) return json({ warmed: false });

  try {
    if (!(await readCloudAccess(session.admin, session.user.id)).tasks) return json({ warmed: false });
    const warmed = await warmSpare(session.admin, new FlyMachines(config), config, session.user.id);
    return json({ warmed });
  } catch (error) {
    console.error("[Tensor Cloud] Warming a spare sandbox failed", error);
    return json({ warmed: false });
  }
}

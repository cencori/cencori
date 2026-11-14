import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { FlyMachines, readTensorCloudConfig } from "@/lib/tensor-cloud";
import { destroyTask, readTask } from "@/lib/tensor-cloud-tasks";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/**
 * Deletes a task (a project, or a plain chat's workspace): every chat in it, its sandbox and its
 * volume, with whatever was in them.
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const config = readTensorCloudConfig();
  if (!config) return json({ error: "Tensor on the web is not available yet." }, 503);

  try {
    const task = await readTask(session.admin, session.user.id, (await context.params).id);
    if (!task) return json({ error: "That project does not exist." }, 404);
    await destroyTask(session.admin, new FlyMachines(config), task);
    return json({ deleted: true });
  } catch (error) {
    console.error("[Tensor Cloud] Deleting a task failed", error);
    return json({ error: "Tensor could not delete this project." }, 503);
  }
}

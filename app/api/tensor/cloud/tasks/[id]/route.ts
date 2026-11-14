import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { FlyMachines, readTensorCloudConfig } from "@/lib/tensor-cloud";
import { readTask, updateTask } from "@/lib/tensor-cloud-tasks";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/**
 * Deletes a task and destroys its sandbox and its volume, with whatever was in them.
 *
 * The row is marked first: from that moment the sandbox's credential is refused, so even if
 * destroying the machine fails, what is left running can no longer spend anything.
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const config = readTensorCloudConfig();
  if (!config) return json({ error: "Cloud tasks are not available yet." }, 503);

  try {
    const task = await readTask(session.admin, session.user.id, (await context.params).id);
    if (!task) return json({ error: "That task does not exist." }, 404);

    await updateTask(session.admin, task.id, { status: "deleted" });
    const fly = new FlyMachines(config);
    let machineGone = true;
    if (task.machine_id) {
      const destroyed = await fly.destroy(task.machine_id);
      // Already gone is the outcome that was asked for.
      if (!destroyed.ok && destroyed.status !== 404) {
        machineGone = false;
        console.error(
          `[Tensor Cloud] Destroying sandbox ${task.machine_id} of task ${task.id} failed (${destroyed.status}): ${destroyed.error}`,
        );
      }
    }
    // A volume cannot be removed while a machine still holds it, and it is billed until it is.
    // What is logged here is what a clean-up job has to pick up; there is not one yet.
    if (task.volume_id && machineGone) {
      const removed = await fly.destroyVolume(task.volume_id);
      if (!removed.ok && removed.status !== 404) {
        console.error(
          `[Tensor Cloud] Destroying volume ${task.volume_id} of task ${task.id} failed (${removed.status}): ${removed.error}`,
        );
      }
    }
    return json({ deleted: true });
  } catch (error) {
    console.error("[Tensor Cloud] Deleting a task failed", error);
    return json({ error: "Tensor could not delete this task." }, 503);
  }
}

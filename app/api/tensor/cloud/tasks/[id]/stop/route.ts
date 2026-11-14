import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { FlyMachines, readTensorCloudConfig } from "@/lib/tensor-cloud";
import { readTask, updateTask } from "@/lib/tensor-cloud-tasks";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/** Stops a task's sandbox. Its files are kept, and connecting to the task starts it again. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const config = readTensorCloudConfig();
  if (!config) return json({ error: "Cloud tasks are not available yet." }, 503);

  try {
    const task = await readTask(session.admin, session.user.id, (await context.params).id);
    if (!task) return json({ error: "That task does not exist." }, 404);
    if (!task.machine_id || task.status === "failed") {
      return json({ error: "This task has no sandbox to stop." }, 409);
    }

    // Marked before the machine is asked to stop, so its credential is refused from now on.
    await updateTask(session.admin, task.id, { status: "stopped" });
    const stopped = await new FlyMachines(config).stop(task.machine_id);
    if (!stopped.ok) {
      console.error(
        `[Tensor Cloud] Stopping sandbox ${task.machine_id} of task ${task.id} failed (${stopped.status}): ${stopped.error}`,
      );
      return json({ error: "Tensor could not stop this task's sandbox. Try again shortly." }, 503);
    }
    return json({ stopped: true });
  } catch (error) {
    console.error("[Tensor Cloud] Stopping a task failed", error);
    return json({ error: "Tensor could not stop this task." }, 503);
  }
}

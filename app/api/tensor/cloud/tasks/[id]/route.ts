import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { FlyMachines, normalizeProjectName, readTensorCloudConfig } from "@/lib/tensor-cloud";
import { destroyTask, projectJson, readTask, updateTask } from "@/lib/tensor-cloud-tasks";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/**
 * Changes a project: its name, or whether it is archived.
 *
 * Archiving puts a project away without losing anything. Its machine is stopped, since nobody is
 * working in it; its chats and files stay, and unarchiving brings it back as it was.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const config = readTensorCloudConfig();
  if (!config) return json({ error: "Tensor on the web is not available yet." }, 503);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "That request is invalid." }, 400);
  }

  try {
    const task = await readTask(session.admin, session.user.id, (await context.params).id);
    if (!task || !task.project_name) return json({ error: "That project does not exist." }, 404);

    const patch: Parameters<typeof updateTask>[2] = {};
    if (body.name !== undefined) {
      const name = normalizeProjectName(body.name);
      if (!name) return json({ error: "Give the project a name." }, 400);
      patch.project_name = name;
    }
    if (body.archived !== undefined) {
      if (typeof body.archived !== "boolean") return json({ error: "That request is invalid." }, 400);
      patch.archived_at = body.archived ? new Date().toISOString() : null;
      // Put away means not running. Marked first, so its credential is refused from now on.
      if (body.archived && (task.status === "ready" || task.status === "creating")) {
        patch.status = "stopped";
      }
    }
    if (Object.keys(patch).length === 0) return json({ error: "That request is invalid." }, 400);

    await updateTask(session.admin, task.id, patch);
    if (patch.status === "stopped" && task.machine_id) {
      const stopped = await new FlyMachines(config).stop(task.machine_id);
      if (!stopped.ok) {
        // It stops itself when idle in any case; the project is archived either way.
        console.error(
          `[Tensor Cloud] Stopping sandbox ${task.machine_id} of archived task ${task.id} failed (${stopped.status}): ${stopped.error}`,
        );
      }
    }
    return json({ project: projectJson({ ...task, ...patch }) });
  } catch (error) {
    console.error("[Tensor Cloud] Changing a project failed", error);
    return json({ error: "Tensor could not change this project." }, 503);
  }
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

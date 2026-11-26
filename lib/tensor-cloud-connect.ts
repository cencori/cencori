import "server-only";

import type { createAdminClient } from "@/lib/supabaseAdmin";
import { FlyMachines, signGatewayTicket, type TensorCloudConfig } from "@/lib/tensor-cloud";
import {
  listTasks,
  makeRoomFor,
  readCloudAccess,
  readTask,
  reconcileTasks,
  RunningTaskLimitError,
  startSandbox,
  updateTask,
} from "@/lib/tensor-cloud-tasks";

type Admin = ReturnType<typeof createAdminClient>;

/** Said when another conversation's turn is in progress, which is the one thing not interrupted. */
export const STILL_WORKING = "Tensor is still working in another chat. Let it finish, then try again.";

export type SandboxConnection =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string; code?: "archived" | "plan_required" | "running_limit" };

/**
 * Where a project's runtime can be reached, through the gateway, with a ticket for it: what a
 * page asks for before it opens a chat (app/api/tensor/cloud/tasks/[id]/connect), and what
 * Cencori asks for itself when it runs a turn with no page open (lib/tensor-background-turn.ts).
 *
 * A stopped sandbox is started first, so a ticket is only ever made for a machine that is up. The
 * ticket lasts a minute and works once.
 */
export async function connectSandbox(
  admin: Admin,
  config: TensorCloudConfig,
  userId: string,
  taskId: string,
): Promise<SandboxConnection> {
  try {
    const found = await readTask(admin, userId, taskId);
    if (!found) return { ok: false, status: 404, error: "That chat does not exist." };
    if (found.archived_at) {
      return { ok: false, status: 409, code: "archived", error: "This project is archived. Unarchive it to continue." };
    }
    // A plan that has lapsed keeps its tasks but cannot run them.
    if (!(await readCloudAccess(admin, userId)).tasks) {
      return {
        ok: false,
        status: 402,
        code: "plan_required",
        error: "Tensor on the web is part of Tensor's paid plans. Choose a plan to continue.",
      };
    }

    // The sandbox may have stopped itself since the row was last written.
    const fly = new FlyMachines(config);
    const [task] = (await reconcileTasks(admin, fly, [found])) as [typeof found];
    if (!task.machine_id || task.status === "failed" || task.status === "creating") {
      return { ok: false, status: 409, error: "This chat could not be opened. Start a new one." };
    }

    if (task.status === "stopped") {
      const all = await reconcileTasks(admin, fly, await listTasks(admin, userId));
      if (!(await makeRoomFor(admin, fly, all, task.id))) {
        return { ok: false, status: 409, code: "running_limit", error: STILL_WORKING };
      }
      // The running slot is taken in the database before the machine is started, so two tasks
      // opened at once cannot both start: the second fails here, before it costs anything.
      await updateTask(admin, task.id, { status: "ready" });
      const started = await startSandbox(fly, config.sandboxImage, task.machine_id);
      if (!started.ok) {
        console.error(
          `[Tensor Cloud] Starting sandbox ${task.machine_id} of task ${task.id} failed (${started.status}): ${started.error}`,
        );
        await updateTask(admin, task.id, { status: "stopped" });
        return { ok: false, status: 503, error: "Tensor could not reopen this chat. Try again shortly." };
      }
    }
    const ready = await fly.waitFor(task.machine_id, "started");
    if (!ready.ok) return { ok: false, status: 503, error: "This chat is still getting ready. Try again in a moment." };
    await updateTask(admin, task.id, { last_connected_at: new Date().toISOString() });

    const ticket = signGatewayTicket({ userId, taskId: task.id, machineId: task.machine_id }, config.ticketSecret);
    return { ok: true, url: `${config.gatewayUrl}/v1/connect?ticket=${encodeURIComponent(ticket)}` };
  } catch (error) {
    if (error instanceof RunningTaskLimitError) {
      return { ok: false, status: 409, code: "running_limit", error: STILL_WORKING };
    }
    throw error;
  }
}

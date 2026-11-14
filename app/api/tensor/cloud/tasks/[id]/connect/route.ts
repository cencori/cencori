import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { FlyMachines, readTensorCloudConfig, signGatewayTicket } from "@/lib/tensor-cloud";
import {
  listTasks,
  makeRoomFor,
  readCloudAccess,
  readTask,
  reconcileTasks,
  RunningTaskLimitError,
  updateTask,
} from "@/lib/tensor-cloud-tasks";

/** Said when another conversation's turn is in progress, which is the one thing not interrupted. */
const STILL_WORKING =
  "Tensor is still working in another chat. Let it finish, then try again.";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/**
 * Hands the page what it needs to open a task: where the gateway is, and a ticket for it.
 *
 * A stopped sandbox is started first, so the page only ever receives a ticket for a machine that
 * is up. The ticket lasts a minute and works once; the page asks again each time it connects.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const config = readTensorCloudConfig();
  if (!config) return json({ error: "Tensor on the web is not available yet." }, 503);

  try {
    const found = await readTask(session.admin, session.user.id, (await context.params).id);
    if (!found) return json({ error: "That chat does not exist." }, 404);
    // A plan that has lapsed keeps its tasks but cannot run them.
    if (!(await readCloudAccess(session.admin, session.user.id)).tasks) {
      return json(
        { error: "Tensor on the web is part of Tensor's paid plans. Choose a plan to continue.", code: "plan_required" },
        402,
      );
    }

    // The sandbox may have stopped itself since the row was last written.
    const fly = new FlyMachines(config);
    const [task] = (await reconcileTasks(session.admin, fly, [found])) as [typeof found];
    if (!task.machine_id || task.status === "failed" || task.status === "creating") {
      return json({ error: "This chat could not be opened. Start a new one." }, 409);
    }

    if (task.status === "stopped") {
      const all = await reconcileTasks(session.admin, fly, await listTasks(session.admin, session.user.id));
      if (!(await makeRoomFor(session.admin, fly, session.user.id, all, task.id))) {
        return json({ error: STILL_WORKING, code: "running_limit" }, 409);
      }
      // The running slot is taken in the database before the machine is started, so two tasks
      // opened at once cannot both start: the second fails here, before it costs anything.
      await updateTask(session.admin, task.id, { status: "ready" });
      const started = await fly.start(task.machine_id);
      if (!started.ok) {
        console.error(
          `[Tensor Cloud] Starting sandbox ${task.machine_id} of task ${task.id} failed (${started.status}): ${started.error}`,
        );
        await updateTask(session.admin, task.id, { status: "stopped" });
        return json({ error: "Tensor could not reopen this chat. Try again shortly." }, 503);
      }
    }
    const ready = await fly.waitFor(task.machine_id, "started");
    if (!ready.ok) {
      return json({ error: "This chat is still getting ready. Try again in a moment." }, 503);
    }
    await updateTask(session.admin, task.id, { last_connected_at: new Date().toISOString() });

    const ticket = signGatewayTicket(
      { userId: session.user.id, taskId: task.id, machineId: task.machine_id },
      config.ticketSecret,
    );
    return json({ url: `${config.gatewayUrl}/v1/connect?ticket=${encodeURIComponent(ticket)}` });
  } catch (error) {
    if (error instanceof RunningTaskLimitError) {
      return json({ error: STILL_WORKING, code: "running_limit" }, 409);
    }
    console.error("[Tensor Cloud] Connecting to a task failed", error);
    return json({ error: "Tensor could not open this chat." }, 503);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import {
  FlyMachines,
  normalizeRepositoryRef,
  normalizeRepositoryUrl,
  readTensorCloudConfig,
  sandboxMachineRequest,
} from "@/lib/tensor-cloud";
import {
  insertTask,
  listTasks,
  MAX_KEPT_TASKS,
  MAX_RUNNING_TASKS,
  readCloudAccess,
  reconcileTasks,
  RunningTaskLimitError,
  taskJson,
  updateTask,
} from "@/lib/tensor-cloud-tasks";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/** The account's cloud tasks, newest first. */
export async function GET(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const config = readTensorCloudConfig();
  if (!config) return json({ error: "Cloud tasks are not available yet." }, 503);

  try {
    const [access, listed] = await Promise.all([
      readCloudAccess(session.admin, session.user.id),
      listTasks(session.admin, session.user.id),
    ]);
    const tasks = await reconcileTasks(session.admin, new FlyMachines(config), listed);
    return json({ access, tasks: tasks.map(taskJson) });
  } catch (error) {
    console.error("[Tensor Cloud] Listing tasks failed", error);
    return json({ error: "Tensor could not load your cloud tasks." }, 503);
  }
}

/**
 * Starts a task: a row here, then a sandbox on Fly with the repository cloned into it.
 *
 * The row comes first and the machine is named after it, so a machine can always be traced to a
 * task and an account. A machine that could not be created leaves a `failed` row, never a machine
 * nobody knows about.
 */
export async function POST(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const config = readTensorCloudConfig();
  if (!config) return json({ error: "Cloud tasks are not available yet." }, 503);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "That request is invalid." }, 400);
  }
  const repositoryUrl = normalizeRepositoryUrl(body.repositoryUrl);
  if (!repositoryUrl) {
    return json({ error: "Enter a public GitHub repository, like https://github.com/owner/name." }, 400);
  }
  const hasRef = body.repositoryRef !== undefined && body.repositoryRef !== null && body.repositoryRef !== "";
  const repositoryRef = hasRef ? normalizeRepositoryRef(body.repositoryRef) : null;
  if (hasRef && !repositoryRef) return json({ error: "That branch name is not valid." }, 400);

  try {
    const access = await readCloudAccess(session.admin, session.user.id);
    if (!access.tasks) {
      return json(
        { error: "Cloud tasks are part of Tensor's paid plans. Choose a plan to start one.", code: "plan_required" },
        402,
      );
    }
    const fly = new FlyMachines(config);
    const existing = await reconcileTasks(
      session.admin,
      fly,
      await listTasks(session.admin, session.user.id),
    );
    const running = existing.filter((task) => task.status === "ready" || task.status === "creating");
    if (running.length >= MAX_RUNNING_TASKS) {
      return json(
        { error: "You already have a cloud task running. Stop it before starting another.", code: "running_limit" },
        409,
      );
    }
    if (existing.length >= MAX_KEPT_TASKS) {
      return json(
        { error: "You have reached the number of cloud tasks you can keep. Delete one to continue.", code: "kept_limit" },
        409,
      );
    }

    const task = await insertTask(session.admin, {
      userId: session.user.id,
      repositoryUrl,
      repositoryRef,
    });
    // The volume first: the machine is created with it mounted, in the same region.
    const volume = await fly.createVolume(task.id);
    if (!volume.ok) {
      console.error(`[Tensor Cloud] Creating a volume failed (${volume.status}): ${volume.error}`);
      await updateTask(session.admin, task.id, { status: "failed" });
      return json({ error: "Tensor could not start a sandbox for this task. Try again shortly." }, 503);
    }
    await updateTask(session.admin, task.id, { volume_id: volume.value.id });

    const created = await fly.create(
      sandboxMachineRequest(
        {
          taskId: task.id,
          userId: session.user.id,
          volumeId: volume.value.id,
          repositoryUrl,
          repositoryRef,
        },
        config,
      ),
    );
    if (!created.ok) {
      console.error(`[Tensor Cloud] Creating a sandbox failed (${created.status}): ${created.error}`);
      await updateTask(session.admin, task.id, { status: "failed" });
      // Nothing was ever written to it, and an unused volume is still billed.
      const removed = await fly.destroyVolume(volume.value.id);
      if (removed.ok) await updateTask(session.admin, task.id, { volume_id: null });
      else console.error(`[Tensor Cloud] Volume ${volume.value.id} of failed task ${task.id} was not removed: ${removed.error}`);
      return json({ error: "Tensor could not start a sandbox for this task. Try again shortly." }, 503);
    }
    await updateTask(session.admin, task.id, {
      machine_id: created.value.id,
      region: created.value.region,
      status: "ready",
    });
    return json({ task: taskJson({ ...task, status: "ready" }) }, 201);
  } catch (error) {
    if (error instanceof RunningTaskLimitError) {
      return json(
        { error: "You already have a cloud task running. Stop it before starting another.", code: "running_limit" },
        409,
      );
    }
    console.error("[Tensor Cloud] Starting a task failed", error);
    return json({ error: "Tensor could not start this task." }, 503);
  }
}

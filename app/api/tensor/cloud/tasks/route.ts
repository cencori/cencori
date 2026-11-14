import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import {
  FlyMachines,
  normalizeProjectName,
  normalizeRepositoryRef,
  normalizeRepositoryUrl,
  normalizeTaskTitle,
  readTensorCloudConfig,
  sandboxMachineRequest,
} from "@/lib/tensor-cloud";
import {
  insertTask,
  listTasks,
  makeRoomFor,
  MAX_KEPT_TASKS,
  readCloudAccess,
  reconcileTasks,
  RunningTaskLimitError,
  taskJson,
  updateTask,
} from "@/lib/tensor-cloud-tasks";

/** Said when another conversation's turn is in progress, which is the one thing not interrupted. */
const STILL_WORKING =
  "Tensor is still working in another chat. Let it finish, then try again.";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/** The account's cloud tasks, newest first. */
export async function GET(request: NextRequest) {
  const session = await authenticateTensorBillingRequest(request);
  if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
  const config = readTensorCloudConfig();
  if (!config) return json({ error: "Tensor on the web is not available yet." }, 503);

  try {
    const [access, listed] = await Promise.all([
      readCloudAccess(session.admin, session.user.id),
      listTasks(session.admin, session.user.id),
    ]);
    const tasks = await reconcileTasks(session.admin, new FlyMachines(config), listed);
    return json({ access, tasks: tasks.map(taskJson) });
  } catch (error) {
    console.error("[Tensor Cloud] Listing tasks failed", error);
    return json({ error: "Tensor could not load your chats." }, 503);
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
  if (!config) return json({ error: "Tensor on the web is not available yet." }, 503);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "That request is invalid." }, 400);
  }
  // A repository is optional: without one the task starts in an empty workspace. One that is
  // given must be valid; a typo is an error, not a silent fall back to starting from nothing.
  const given = (value: unknown) => value !== undefined && value !== null && value !== "";
  const repositoryUrl = given(body.repositoryUrl) ? normalizeRepositoryUrl(body.repositoryUrl) : null;
  if (given(body.repositoryUrl) && !repositoryUrl) {
    return json({ error: "Enter a public GitHub repository, like https://github.com/owner/name." }, 400);
  }
  const hasRef = repositoryUrl !== null && given(body.repositoryRef);
  const repositoryRef = hasRef ? normalizeRepositoryRef(body.repositoryRef) : null;
  if (hasRef && !repositoryRef) return json({ error: "That branch name is not valid." }, 400);
  const title = normalizeTaskTitle(body.title);
  // Named, it is a project; an imported repository is one even unnamed, under its own name.
  const projectName =
    normalizeProjectName(body.projectName) ??
    (repositoryUrl ? repositoryUrl.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "") : null);

  try {
    const access = await readCloudAccess(session.admin, session.user.id);
    if (!access.tasks) {
      return json(
        { error: "Tensor on the web is part of Tensor's paid plans. Choose a plan to start.", code: "plan_required" },
        402,
      );
    }
    const fly = new FlyMachines(config);
    const existing = await reconcileTasks(
      session.admin,
      fly,
      await listTasks(session.admin, session.user.id),
    );
    if (existing.length >= MAX_KEPT_TASKS) {
      return json(
        { error: "You have reached the number of chats you can keep. Delete one to start another.", code: "kept_limit" },
        409,
      );
    }
    if (!(await makeRoomFor(session.admin, fly, session.user.id, existing, null))) {
      return json({ error: STILL_WORKING, code: "running_limit" }, 409);
    }

    const task = await insertTask(session.admin, {
      userId: session.user.id,
      title,
      projectName,
      repositoryUrl,
      repositoryRef,
    });
    // The volume first: the machine is created with it mounted, in the same region.
    const volume = await fly.createVolume(task.id);
    if (!volume.ok) {
      console.error(`[Tensor Cloud] Creating a volume failed (${volume.status}): ${volume.error}`);
      await updateTask(session.admin, task.id, { status: "failed" });
      return json({ error: "Tensor could not get this chat ready. Try again shortly." }, 503);
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
      return json({ error: "Tensor could not get this chat ready. Try again shortly." }, 503);
    }
    await updateTask(session.admin, task.id, {
      machine_id: created.value.id,
      region: created.value.region,
      status: "ready",
    });
    return json({ task: taskJson({ ...task, status: "ready" }) }, 201);
  } catch (error) {
    if (error instanceof RunningTaskLimitError) {
      return json({ error: STILL_WORKING, code: "running_limit" }, 409);
    }
    console.error("[Tensor Cloud] Starting a task failed", error);
    return json({ error: "Tensor could not start this task." }, 503);
  }
}

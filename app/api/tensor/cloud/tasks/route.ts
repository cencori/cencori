import { waitUntil } from "@vercel/functions";
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
  chatJson,
  claimSpare,
  ensureSpare,
  insertChat,
  insertTask,
  listChats,
  listTasks,
  makeRoomFor,
  MAX_KEPT_TASKS,
  projectJson,
  projectsAmong,
  readCloudAccess,
  reconcileTasks,
  RunningTaskLimitError,
  taskJson,
  updateTask,
} from "@/lib/tensor-cloud-tasks";

/** Runs ensureSpare where a failure is nobody's problem but the log's: it is an optimisation. */
async function prepareSpare(
  admin: Parameters<typeof ensureSpare>[0],
  config: Parameters<typeof ensureSpare>[2],
  userId: string,
): Promise<void> {
  try {
    await ensureSpare(admin, new FlyMachines(config), config, userId);
  } catch (error) {
    console.error("[Tensor Cloud] Preparing a spare sandbox failed", error);
  }
}

/** Said when another conversation's turn is in progress, which is the one thing not interrupted. */
const STILL_WORKING =
  "Tensor is still working in another chat. Let it finish, then try again.";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/** The account's projects and chats, most recently used first. */
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
    const chats = await listChats(session.admin, session.user.id, tasks);
    // Whoever can start a chat gets a spare workspace made behind this response, so their next
    // chat starts without waiting for one to be built.
    if (access.tasks) waitUntil(prepareSpare(session.admin, config, session.user.id));
    return json({
      access,
      // Projects are listed in their own right: one exists before its first chat, and after its
      // last, so it cannot be worked out from the chats.
      projects: projectsAmong(tasks).map(projectJson),
      chats: chats.map(({ chat, task }) => chatJson(chat, task)),
    });
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
  // What is created here is a project: a workspace with a name, made new or imported from a
  // repository (which names it, unless a name is given). Chats are started in it afterwards,
  // by the project's own chats route. A title asks for a first chat to be made along with it.
  const title = normalizeTaskTitle(body.title);
  const projectName =
    normalizeProjectName(body.projectName) ??
    (repositoryUrl ? repositoryUrl.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "") : null);
  if (!projectName) {
    return json({ error: "Give the project a name.", code: "project_required" }, 400);
  }

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
    if (!(await makeRoomFor(session.admin, fly, existing, null))) {
      return json({ error: STILL_WORKING, code: "running_limit" }, 409);
    }

    // A chat that starts from nothing takes the account's spare workspace when there is one:
    // the machine already exists and only has to start. An imported repository cannot, because
    // a machine is told what to clone when it is created.
    if (!repositoryUrl) {
      const claimed = await claimSpare(session.admin, config, {
        userId: session.user.id,
        title,
        projectName,
      });
      if (claimed?.machine_id) {
        // Not waited for: opening the chat waits for the machine, and it may already be up.
        const started = await fly.start(claimed.machine_id);
        if (!started.ok) {
          console.error(
            `[Tensor Cloud] Starting claimed sandbox ${claimed.machine_id} of task ${claimed.id} failed (${started.status}): ${started.error}`,
          );
        }
        const chat = title
          ? await insertChat(session.admin, { taskId: claimed.id, userId: session.user.id, title })
          : null;
        waitUntil(prepareSpare(session.admin, config, session.user.id));
        return json(
          {
            task: taskJson(claimed),
            project: projectJson(claimed),
            chat: chat ? chatJson(chat, claimed) : null,
          },
          201,
        );
      }
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
    const ready = { ...task, status: "ready" as const };
    const chat = title
      ? await insertChat(session.admin, { taskId: task.id, userId: session.user.id, title })
      : null;
    waitUntil(prepareSpare(session.admin, config, session.user.id));
    return json(
      {
        task: taskJson(ready),
        project: projectJson(ready),
        chat: chat ? chatJson(chat, ready) : null,
      },
      201,
    );
  } catch (error) {
    if (error instanceof RunningTaskLimitError) {
      return json({ error: STILL_WORKING, code: "running_limit" }, 409);
    }
    console.error("[Tensor Cloud] Starting a task failed", error);
    return json({ error: "Tensor could not start this task." }, 503);
  }
}

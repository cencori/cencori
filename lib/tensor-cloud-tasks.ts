import { createAdminClient } from "@/lib/supabaseAdmin";
import { authenticateTensorDataRequest, isUuid } from "@/lib/tensor-data";
import { effectiveTensorPlan, getOrCreateTensorBillingAccount } from "@/lib/tensor-billing";
import {
  type FlyMachines,
  isTaskToken,
  readTensorCloudConfig,
  sandboxMachineRequest,
  tensorCloudAccess,
  type TensorCloudAccess,
  type TensorCloudConfig,
  verifyTaskToken,
} from "@/lib/tensor-cloud";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * `spare` is a workspace made ahead of time and not yet anybody's chat: a volume and a machine
 * that exists but has never been started. It is invisible everywhere a person looks.
 */
export type TensorCloudTaskStatus =
  | "creating"
  | "ready"
  | "stopped"
  | "failed"
  | "deleted"
  | "spare";

export type TensorCloudTask = {
  id: string;
  user_id: string;
  title: string | null;
  project_name: string | null;
  repository_url: string | null;
  repository_ref: string | null;
  machine_id: string | null;
  volume_id: string | null;
  /** The sandbox image the machine was created from; a spare on an old image is replaced. */
  image?: string | null;
  region: string | null;
  status: TensorCloudTaskStatus;
  last_connected_at: string | null;
  /** When the project was archived; null or absent for one in use. */
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

const TABLE = "tensor_cloud_tasks";

/**
 * How many sandboxes one account may have running at once. A sandbox costs money for every second
 * it runs whether or not the agent is doing anything, and that cost is ours, not the plan's.
 *
 * The database holds this to one (tensor_cloud_tasks_one_running_idx); the routes check it first
 * only to say so kindly. Changing the number means changing that index too.
 */
export const MAX_RUNNING_TASKS = 1;

/** Thrown when a write would give an account a second running sandbox. */
export class RunningTaskLimitError extends Error {
  constructor() {
    super("This account already has a running cloud task.");
    this.name = "RunningTaskLimitError";
  }
}

/** Postgres's unique-violation code: here, only the one-running-task index can raise it. */
function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}
/** How many tasks, running or stopped, an account may keep. Each stopped one still holds a disk. */
export const MAX_KEPT_TASKS = 10;

/** What this account's plan includes of Tensor in the cloud, read fresh: plans lapse. */
export async function readCloudAccess(admin: Admin, userId: string): Promise<TensorCloudAccess> {
  const account = await getOrCreateTensorBillingAccount(admin, userId);
  return tensorCloudAccess(effectiveTensorPlan(account));
}

/**
 * Brings the rows in line with what Fly says is actually running.
 *
 * A sandbox stops itself when it has been idle (see the entrypoint in the Tensor repo), and
 * nothing tells this database. Until it is told, the row still says `ready`: the account's one
 * running slot stays taken by a machine that is off, and its credential stays good. So before any
 * decision that depends on what is running, each `ready` task is checked against its machine.
 *
 * A machine Fly cannot be asked about is left as it is: an outage must not free the slot.
 */
export async function reconcileTasks(
  admin: Admin,
  fly: Pick<FlyMachines, "get">,
  tasks: TensorCloudTask[],
): Promise<TensorCloudTask[]> {
  return Promise.all(
    tasks.map(async (task) => {
      if (task.status !== "ready" || !task.machine_id) return task;
      const machine = await fly.get(task.machine_id);
      const gone = !machine.ok && machine.status === 404;
      const off = machine.ok && ["stopped", "suspended", "destroyed"].includes(machine.value.state);
      if (!gone && !off) return task;
      const status: TensorCloudTaskStatus = gone || (machine.ok && machine.value.state === "destroyed") ? "failed" : "stopped";
      await updateTask(admin, task.id, { status });
      return { ...task, status };
    }),
  );
}

/**
 * A project, as the site lists it: a workspace someone named. It exists from the moment it is
 * created, before any chat is started in it, and keeps existing when its chats are deleted.
 */
export function projectJson(task: TensorCloudTask) {
  return {
    id: task.id,
    name: task.project_name ?? "",
    repositoryUrl: task.repository_url,
    status: task.status,
    archivedAt: task.archived_at ?? null,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

/** The tasks that are projects a person can see: named, and not failed, deleted or spare. */
export function projectsAmong(tasks: TensorCloudTask[]): TensorCloudTask[] {
  return tasks.filter(
    (task) =>
      Boolean(task.project_name) &&
      task.status !== "failed" &&
      task.status !== "deleted" &&
      task.status !== "spare",
  );
}

/**
 * Whether Tensor is in the middle of a turn for this account, on any device.
 *
 * Every turn holds a usage reservation from before it starts until it ends, so an open one means
 * work is in progress somewhere. It does not say where, which is why the caller treats it as
 * "do not stop anything".
 */
export async function hasOpenTurn(admin: Admin, userId: string): Promise<boolean> {
  const account = await getOrCreateTensorBillingAccount(admin, userId);
  const { data, error } = await admin
    .from("basecode_turn_reservations")
    .select("id")
    .eq("account_id", account.id)
    .in("status", ["reserved", "running"])
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * Frees the account's running slot for the task about to start or wake.
 *
 * People are not shown sandboxes and are not asked to manage them: opening one conversation while
 * another's machine is still up should simply work. So the other machine is put to sleep, which
 * loses nothing (its files and conversation are on its volume) unless Tensor is mid-turn there.
 * That is the one case this refuses, by returning false: a turn must not be cut off because the
 * person looked at something else.
 *
 * `tasks` must already be reconciled against Fly.
 */
export async function makeRoomFor(
  admin: Admin,
  fly: Pick<FlyMachines, "stop">,
  userId: string,
  tasks: TensorCloudTask[],
  exceptTaskId: string | null,
): Promise<boolean> {
  const running = tasks.filter(
    (task) => task.id !== exceptTaskId && (task.status === "ready" || task.status === "creating"),
  );
  if (running.length === 0) return true;
  if (await hasOpenTurn(admin, userId)) return false;

  for (const task of running) {
    // Marked first, so its credential is refused from now on and the slot is free even if the
    // machine is slow to stop; it stops itself when idle in any case.
    await updateTask(admin, task.id, { status: "stopped" });
    if (task.machine_id) {
      const stopped = await fly.stop(task.machine_id);
      if (!stopped.ok) {
        console.error(
          `[Tensor Cloud] Putting sandbox ${task.machine_id} of task ${task.id} to sleep failed (${stopped.status}): ${stopped.error}`,
        );
      }
    }
  }
  return true;
}

/** What the site is shown of a task. Never the machine: the browser has no use for where it runs. */
export function taskJson(task: TensorCloudTask) {
  return {
    id: task.id,
    title: task.title,
    projectName: task.project_name,
    repositoryUrl: task.repository_url,
    repositoryRef: task.repository_ref,
    status: task.status,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

export async function listTasks(admin: Admin, userId: string): Promise<TensorCloudTask[]> {
  const { data, error } = await admin
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .neq("status", "deleted")
    .neq("status", "spare")
    .order("created_at", { ascending: false })
    .limit(MAX_KEPT_TASKS * 2);
  if (error) throw error;
  return (data ?? []) as TensorCloudTask[];
}

/** One of this account's tasks, or null: another account's task is indistinguishable from none. */
export async function readTask(
  admin: Admin,
  userId: string,
  taskId: unknown,
): Promise<TensorCloudTask | null> {
  if (!isUuid(taskId)) return null;
  const { data, error } = await admin
    .from(TABLE)
    .select("*")
    .eq("id", taskId)
    .eq("user_id", userId)
    .neq("status", "deleted")
    .maybeSingle();
  if (error) throw error;
  return (data as TensorCloudTask | null) ?? null;
}

export async function insertTask(
  admin: Admin,
  input: {
    userId: string;
    title: string | null;
    projectName: string | null;
    repositoryUrl: string | null;
    repositoryRef: string | null;
  },
): Promise<TensorCloudTask> {
  const { data, error } = await admin
    .from(TABLE)
    .insert({
      user_id: input.userId,
      title: input.title,
      project_name: input.projectName,
      repository_url: input.repositoryUrl,
      repository_ref: input.repositoryRef,
    })
    .select("*")
    .single();
  if (isUniqueViolation(error)) throw new RunningTaskLimitError();
  if (error) throw error;
  return data as TensorCloudTask;
}

export async function updateTask(
  admin: Admin,
  taskId: string,
  patch: Partial<Pick<
    TensorCloudTask,
    "machine_id" | "volume_id" | "region" | "status" | "last_connected_at" | "project_name" | "archived_at"
  >>,
): Promise<void> {
  const { error } = await admin
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  if (isUniqueViolation(error)) throw new RunningTaskLimitError();
  if (error) throw error;
}

/* ---------------------------------------------------------------------------
   Spares

   Making a workspace takes many seconds: a volume, a machine, an image to unpack. Nobody should
   watch that happen after pressing send. So each account that can use the web keeps one spare:
   made in the background, never started, costing only its small disk. A new chat claims it and
   starts it (about two seconds), and the next spare is made behind it.
   --------------------------------------------------------------------------- */

async function readSpare(admin: Admin, userId: string): Promise<TensorCloudTask | null> {
  const { data, error } = await admin
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("status", "spare")
    .maybeSingle();
  if (error) throw error;
  return (data as TensorCloudTask | null) ?? null;
}

/**
 * Makes sure the account has a usable spare. Meant to run after a response has been sent.
 *
 * A spare that was only half made, or was made from an image that is no longer the current one,
 * is destroyed and replaced. Two calls at once cannot both make one: the row comes first, and the
 * database allows an account a single spare.
 */
export async function ensureSpare(
  admin: Admin,
  fly: Pick<FlyMachines, "create" | "createVolume" | "destroy" | "destroyVolume">,
  config: TensorCloudConfig,
  userId: string,
): Promise<void> {
  const existing = await readSpare(admin, userId);
  if (existing?.machine_id && existing.image === config.sandboxImage) return;
  if (existing) {
    // Mid-creation by another request, most likely: give it time before calling it abandoned.
    if (Date.now() - new Date(existing.created_at).getTime() < 2 * 60 * 1000) return;
    await destroyTask(admin, fly, existing);
  }

  const { data, error } = await admin
    .from(TABLE)
    .insert({ user_id: userId, status: "spare", image: config.sandboxImage })
    .select("*")
    .single();
  if (isUniqueViolation(error)) return;
  if (error) throw error;
  const spare = data as TensorCloudTask;

  const volume = await fly.createVolume(spare.id);
  if (!volume.ok) {
    console.error(`[Tensor Cloud] Creating a spare volume failed (${volume.status}): ${volume.error}`);
    await destroyTask(admin, fly, spare);
    return;
  }
  await updateTask(admin, spare.id, { volume_id: volume.value.id });

  const machine = await fly.create(
    sandboxMachineRequest(
      {
        taskId: spare.id,
        userId,
        volumeId: volume.value.id,
        repositoryUrl: null,
        repositoryRef: null,
        launch: false,
      },
      config,
    ),
  );
  if (!machine.ok) {
    console.error(`[Tensor Cloud] Creating a spare sandbox failed (${machine.status}): ${machine.error}`);
    await destroyTask(admin, fly, { ...spare, volume_id: volume.value.id });
    return;
  }
  await updateTask(admin, spare.id, { machine_id: machine.value.id, region: machine.value.region });
}

/**
 * Starts the account's spare, if it has one: called when someone begins to type, so that the
 * machine is up by the time they send. An unused one stops itself when idle, like any other.
 */
export async function warmSpare(
  admin: Admin,
  fly: Pick<FlyMachines, "start">,
  config: TensorCloudConfig,
  userId: string,
): Promise<boolean> {
  const spare = await readSpare(admin, userId);
  if (!spare?.machine_id || spare.image !== config.sandboxImage) return false;
  const started = await fly.start(spare.machine_id);
  return started.ok;
}

/**
 * Turns the account's spare into a chat's workspace, or returns null when there is none to use.
 *
 * The update names the status it expects, so two chats started at once cannot both take the same
 * spare: one gets the row, the other gets null and has a workspace made the slow way.
 */
export async function claimSpare(
  admin: Admin,
  config: TensorCloudConfig,
  input: { userId: string; title: string | null; projectName: string | null },
): Promise<TensorCloudTask | null> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from(TABLE)
    .update({
      status: "ready",
      title: input.title,
      project_name: input.projectName,
      created_at: now,
      updated_at: now,
    })
    .eq("user_id", input.userId)
    .eq("status", "spare")
    .eq("image", config.sandboxImage)
    .not("machine_id", "is", null)
    .select("*")
    .maybeSingle();
  if (isUniqueViolation(error)) throw new RunningTaskLimitError();
  if (error) throw error;
  return (data as TensorCloudTask | null) ?? null;
}

/* ---------------------------------------------------------------------------
   Chats

   A task is the workspace; a chat is one conversation in it. A plain chat is a task with a single
   chat. A project is a task with a name, and can hold several: they share its files, and each is
   its own thread in the agent runtime.
   --------------------------------------------------------------------------- */

const CHATS = "tensor_cloud_chats";

/** How many chats one project may hold. Each is cheap, but the list has to stay usable. */
export const MAX_CHATS_PER_TASK = 50;

export type TensorCloudChat = {
  id: string;
  task_id: string;
  user_id: string;
  title: string | null;
  thread_id: string | null;
  /** When the chat was archived; null or absent for one in use. */
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

/** What the site is shown of a chat: the conversation, and the workspace it is in. */
export function chatJson(chat: TensorCloudChat, task: TensorCloudTask) {
  return {
    id: chat.id,
    taskId: task.id,
    title: chat.title,
    threadId: chat.thread_id,
    archivedAt: chat.archived_at ?? null,
    projectName: task.project_name,
    repositoryUrl: task.repository_url,
    status: task.status,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
  };
}

/** The runtime's thread ids are UUIDs; anything else is not one and is never stored. */
export function isThreadId(value: unknown): value is string {
  return isUuid(value);
}

export async function insertChat(
  admin: Admin,
  input: { id?: string; taskId: string; userId: string; title: string | null },
): Promise<TensorCloudChat> {
  const { data, error } = await admin
    .from(CHATS)
    .insert({
      ...(input.id ? { id: input.id } : {}),
      task_id: input.taskId,
      user_id: input.userId,
      title: input.title,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as TensorCloudChat;
}

/**
 * The account's chats, newest first, each with its task; chats of failed tasks are left out.
 *
 * A task with no chat at all gets its first one here, under the task's own id. That is every
 * task made before chats were rows of their own that the migration could not see, and it is what
 * keeps the address of an existing chat working.
 */
export async function listChats(
  admin: Admin,
  userId: string,
  tasks: TensorCloudTask[],
): Promise<Array<{ chat: TensorCloudChat; task: TensorCloudTask }>> {
  const live = tasks.filter(
    (task) => task.status !== "failed" && task.status !== "deleted" && task.status !== "spare",
  );
  if (live.length === 0) return [];
  const byId = new Map(live.map((task) => [task.id, task]));

  const { data, error } = await admin
    .from(CHATS)
    .select("*")
    .eq("user_id", userId)
    .in("task_id", [...byId.keys()])
    .order("updated_at", { ascending: false })
    .limit(MAX_KEPT_TASKS * MAX_CHATS_PER_TASK);
  if (error) throw error;
  const chats = (data ?? []) as TensorCloudChat[];

  const covered = new Set(chats.map((chat) => chat.task_id));
  for (const task of live) {
    if (covered.has(task.id)) continue;
    const { data: made, error: failed } = await admin
      .from(CHATS)
      .upsert(
        {
          id: task.id,
          task_id: task.id,
          user_id: userId,
          title: task.title,
          created_at: task.created_at,
          updated_at: task.updated_at,
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();
    if (failed) throw failed;
    chats.push(made as TensorCloudChat);
  }

  return chats
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .map((chat) => ({ chat, task: byId.get(chat.task_id) as TensorCloudTask }));
}

/** One of this account's chats, or null: another account's chat is indistinguishable from none. */
export async function readChat(
  admin: Admin,
  userId: string,
  chatId: unknown,
): Promise<TensorCloudChat | null> {
  if (!isUuid(chatId)) return null;
  const { data, error } = await admin
    .from(CHATS)
    .select("*")
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as TensorCloudChat | null) ?? null;
}

export async function countChats(admin: Admin, taskId: string): Promise<number> {
  const { count, error } = await admin
    .from(CHATS)
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Records which runtime thread a chat is, the first time it is known.
 *
 * Set once: the page reports it after the chat's first message creates the thread, and a chat
 * never becomes a different conversation afterwards. A second report is ignored, not an error.
 */
export async function setChatThread(admin: Admin, chatId: string, threadId: string): Promise<void> {
  const { error } = await admin
    .from(CHATS)
    .update({ thread_id: threadId, updated_at: new Date().toISOString() })
    .eq("id", chatId)
    .is("thread_id", null);
  if (error) throw error;
}

/** Puts a chat away, or brings it back. Nothing in it changes; only whether it is listed. */
export async function setChatArchived(admin: Admin, chatId: string, archived: boolean): Promise<void> {
  const { error } = await admin
    .from(CHATS)
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", chatId);
  if (error) throw error;
}

/** Gives a chat a new name. Only what it is called changes, not when it was last used. */
export async function setChatTitle(admin: Admin, chatId: string, title: string): Promise<void> {
  const { error } = await admin.from(CHATS).update({ title }).eq("id", chatId);
  if (error) throw error;
}

/** Moves a chat to the top of the list: something just happened in it. */
export async function touchChat(admin: Admin, chatId: string): Promise<void> {
  const { error } = await admin
    .from(CHATS)
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatId);
  if (error) throw error;
}

export async function deleteChatRow(admin: Admin, chatId: string): Promise<void> {
  const { error } = await admin.from(CHATS).delete().eq("id", chatId);
  if (error) throw error;
}

/** Every chat of a task. Tasks are marked deleted, not removed, so their chats go explicitly. */
export async function deleteChatsOfTask(admin: Admin, taskId: string): Promise<void> {
  const { error } = await admin.from(CHATS).delete().eq("task_id", taskId);
  if (error) throw error;
}

/* ---------------------------------------------------------------------------
   Deployments: the address a project is published at
   --------------------------------------------------------------------------- */

const DEPLOYMENTS = "tensor_cloud_deployments";

export type TensorCloudDeployment = {
  task_id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export function deploymentJson(deployment: TensorCloudDeployment) {
  return { name: deployment.name, publishedAt: deployment.published_at, updatedAt: deployment.updated_at };
}

export async function readDeployment(admin: Admin, taskId: string): Promise<TensorCloudDeployment | null> {
  const { data, error } = await admin.from(DEPLOYMENTS).select("*").eq("task_id", taskId).maybeSingle();
  if (error) throw error;
  return (data as TensorCloudDeployment | null) ?? null;
}

/** Whether a name is free, or already this project's own. */
export async function siteNameAvailable(admin: Admin, name: string, taskId: string): Promise<boolean> {
  const { data, error } = await admin.from(DEPLOYMENTS).select("task_id").eq("name", name).maybeSingle();
  if (error) throw error;
  return !data || (data as { task_id: string }).task_id === taskId;
}

/**
 * Gives a project a name, or changes the one it has. "taken" when another project holds it: the
 * database's own rule (one row per name) decides, so two claims at once cannot both win.
 */
export async function claimSiteName(
  admin: Admin,
  task: Pick<TensorCloudTask, "id" | "user_id">,
  name: string,
): Promise<TensorCloudDeployment | "taken"> {
  const { data, error } = await admin
    .from(DEPLOYMENTS)
    .upsert(
      { task_id: task.id, user_id: task.user_id, name, updated_at: new Date().toISOString() },
      { onConflict: "task_id" },
    )
    .select("*")
    .single();
  // 23505: a unique rule was broken, and the only one a claim can break is the name's.
  if (error) {
    if ((error as { code?: string }).code === "23505") return "taken";
    throw error;
  }
  return data as TensorCloudDeployment;
}

/** Records that what is served under a project's name has just been replaced. */
export async function markPublished(admin: Admin, taskId: string): Promise<TensorCloudDeployment | null> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from(DEPLOYMENTS)
    .update({ published_at: now, updated_at: now })
    .eq("task_id", taskId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as TensorCloudDeployment | null) ?? null;
}

/** Lets a project's name go. The copy being served is the gateway's to remove. */
export async function deleteDeployment(admin: Admin, taskId: string): Promise<void> {
  const { error } = await admin.from(DEPLOYMENTS).delete().eq("task_id", taskId);
  if (error) throw error;
}

/**
 * Deletes a task: its row is marked, its credential dies with that, and its machine and volume
 * are destroyed with whatever was in them.
 *
 * The row is marked first: from that moment the sandbox's credential is refused, so even if
 * destroying the machine fails, what is left running can no longer spend anything.
 */
export async function destroyTask(
  admin: Admin,
  fly: Pick<FlyMachines, "destroy" | "destroyVolume">,
  task: TensorCloudTask,
): Promise<void> {
  await updateTask(admin, task.id, { status: "deleted" });
  await deleteChatsOfTask(admin, task.id);
  // Its name is let go with it, so the address is free for another project.
  await deleteDeployment(admin, task.id);

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
}

/**
 * The account a sandbox's model call acts for, or null.
 *
 * The token's signature says Cencori issued it; the row says it is still good. Both are needed:
 * a sandbox keeps its token for as long as its disk exists, so the task's status is the only
 * thing that can take the credential away.
 *
 * Returns undefined when the bearer is not a task token at all, so the caller falls through to
 * the ordinary session check.
 */
export async function authenticateTensorCloudTask(
  admin: Admin,
  authorization: string | null,
): Promise<{ userId: string; taskId: string } | null | undefined> {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  const token = authorization.slice(7).trim();
  if (!isTaskToken(token)) return undefined;

  const config = readTensorCloudConfig();
  if (!config) return null;
  const claims = verifyTaskToken(token, config.taskTokenSecret);
  if (!claims || !isUuid(claims.taskId)) return null;

  const { data, error } = await admin
    .from(TABLE)
    .select("user_id, status")
    .eq("id", claims.taskId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.status !== "ready" || data.user_id !== claims.userId) return null;
  return { userId: claims.userId, taskId: claims.taskId };
}

/**
 * Who a model call is for: a signed-in user, or a cloud task acting for one.
 *
 * Both end as an account id, which is all the inference proxy needs: the plan check and the usage
 * reservation that follow are the account's either way. A sandbox therefore gets no model call the
 * account could not have made from the desktop app, and none at all between turns.
 */
export async function authenticateTensorInferenceRequest(
  authorization: string | null,
): Promise<{ admin: Admin; user: { id: string } } | null> {
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!isTaskToken(bearer)) return authenticateTensorDataRequest(authorization);

  const admin = createAdminClient();
  const task = await authenticateTensorCloudTask(admin, authorization);
  return task ? { admin, user: { id: task.userId } } : null;
}

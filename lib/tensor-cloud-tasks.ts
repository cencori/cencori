import { createAdminClient } from "@/lib/supabaseAdmin";
import { authenticateTensorDataRequest, isUuid } from "@/lib/tensor-data";
import { effectiveTensorPlan, getOrCreateTensorBillingAccount } from "@/lib/tensor-billing";
import {
  type FlyMachines,
  isTaskToken,
  readTensorCloudConfig,
  tensorCloudAccess,
  type TensorCloudAccess,
  verifyTaskToken,
} from "@/lib/tensor-cloud";

type Admin = ReturnType<typeof createAdminClient>;

export type TensorCloudTaskStatus = "creating" | "ready" | "stopped" | "failed" | "deleted";

export type TensorCloudTask = {
  id: string;
  user_id: string;
  title: string | null;
  project_name: string | null;
  repository_url: string | null;
  repository_ref: string | null;
  machine_id: string | null;
  volume_id: string | null;
  region: string | null;
  status: TensorCloudTaskStatus;
  last_connected_at: string | null;
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
  patch: Partial<Pick<TensorCloudTask, "machine_id" | "volume_id" | "region" | "status" | "last_connected_at">>,
): Promise<void> {
  const { error } = await admin
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  if (isUniqueViolation(error)) throw new RunningTaskLimitError();
  if (error) throw error;
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

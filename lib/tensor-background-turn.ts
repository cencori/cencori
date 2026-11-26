import "server-only";

import { randomUUID } from "node:crypto";

import type { createAdminClient } from "@/lib/supabaseAdmin";
import type { TensorCloudConfig } from "@/lib/tensor-cloud";
import { connectSandbox, type SandboxConnection } from "@/lib/tensor-cloud-connect";
import { noteTurnEnded } from "@/lib/tensor-cloud-tasks";
import { RuntimeClient, type RuntimeNotification } from "@/lib/tensor-runtime-client";
import { finishTensorTurn, reserveTensorTurn, type TurnReservation } from "@/lib/tensor-turn-reservation";

/**
 * Turns Cencori runs in a project with nobody's browser open: the work behind Tensor answering
 * a comment left on a project's published app, and later the Tensor API.
 *
 * It does what the web page does for a message (tensor-by-cencori, task-view.tsx): wakes the
 * project's machine and gets a ticket for it, opens or reopens a conversation, reserves the turn's
 * usage as the project's owner, starts the turn, follows it to its end, and closes the
 * reservation. The turn runs on the machine, not here, so a dropped connection (or this server
 * restarting) does not stop it: the connection is opened again and the turn followed from there.
 *
 * These turns have a conversation of their own in the project, which no chat shows. The project's
 * guide and command (AGENTS.md, tensor.mjs) are already on its disk from the page's sessions, and
 * Tensor's memory hook reports each turn as it does any other, so a chat can recall it later.
 */

type Admin = ReturnType<typeof createAdminClient>;

const TABLE = "tensor_cloud_background_turns";
/** Where the project's code is on its machine, as on the web. */
const WORKSPACE = "/data/repo";
/** The runtime settings the web opens every conversation with. */
const THREAD_CONFIG = { "features.apply_patch_streaming_events": true };
/** The model background turns run on and are reserved for: the web's default. */
const DEFAULT_MODEL = "maximo-atlas-1.5";
/** The origin the gateway lets connect: the site's own, as a page there would send. */
const ORIGIN = (process.env.TENSOR_WEB_ORIGIN?.trim() || "https://tensorade.app").replace(/\/+$/, "");
/** Longest a turn is followed before it is interrupted. */
const TURN_TIMEOUT_MS = 30 * 60_000;
/** How often a dropped connection is opened again within one turn. */
const RECONNECTS = 5;

type Turn = {
  id: string;
  status: "completed" | "interrupted" | "failed" | "inProgress";
  items?: Array<{ type: string; text?: string }>;
  error?: { message?: string } | null;
};
type Thread = { id: string; turns: Turn[] };

export type BackgroundTurnInput = {
  userId: string;
  taskId: string;
  prompt: string;
  /** The project's background conversation, to carry on; a new one when null or gone. */
  threadId?: string | null;
  /**
   * A turn already started (by a server that has since gone): it is followed from where it is,
   * and its reservation closed at the end, instead of a new turn started.
   */
  resume?: { threadId: string; turnId: string; turnKey: string; startedAt: number };
};

export type BackgroundTurnResult =
  | {
      status: "completed" | "failed" | "interrupted";
      threadId: string | null;
      turnId: string | null;
      /** Tensor's last message in the turn. */
      reply: string | null;
      error: string | null;
    }
  /** The account is busy (a turn running, or another project mid-turn): try again later. */
  | { status: "busy"; error: string };

export type BackgroundTurnDeps = {
  connect: () => Promise<SandboxConnection>;
  open: (url: string) => RuntimeClient;
  reserve: (turnKey: string, model: string | null) => Promise<TurnReservation>;
  finish: (turnKey: string, turnId: string | null) => Promise<unknown>;
  turnEnded: () => Promise<void>;
  /** Told once the turn has started, so it can be kept on record. */
  started?: (info: { threadId: string; turnId: string; turnKey: string }) => Promise<void>;
  /** Called every half minute while the turn is followed, to say this server still has it. */
  alive?: () => Promise<void>;
  turnTimeoutMs?: number;
  reconnectDelayMs?: number;
};

const failed = (error: string, threadId: string | null = null, turnId: string | null = null): BackgroundTurnResult => ({
  error,
  reply: null,
  status: "failed",
  threadId,
  turnId,
});

/** The last thing Tensor said in a turn, from its items. */
function lastWords(items: Array<{ type: string; text?: string }> | undefined): string | null {
  const said = (items ?? []).filter((item) => item.type === "agentMessage" && typeof item.text === "string" && item.text.trim());
  return said.at(-1)?.text?.trim() ?? null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs one turn in a project, from reserving its usage to closing that reservation.
 *
 * The reservation comes first, before the project's machine is touched: while the account is
 * busy (a chat, the desktop app), asking again costs a query, not a machine woken for nothing.
 */
export async function driveBackgroundTurn(input: BackgroundTurnInput, deps: BackgroundTurnDeps): Promise<BackgroundTurnResult> {
  let reservedKey: string | null = null;
  if (!input.resume) {
    // Model calls are served only under an open reservation; one turn at a time per account.
    const key = randomUUID();
    const reservation = await deps.reserve(key, DEFAULT_MODEL);
    if (!reservation.allowed) {
      if (reservation.reason === "concurrency_limit") return { error: "Tensor is working on something else for this account.", status: "busy" };
      return failed(
        reservation.reason === "task_limit" || reservation.reason === "trial_limit" || reservation.reason === "pass_budget_limit"
          ? "The account has used its allowance for now."
          : "Tensor could not reserve usage for this turn.",
      );
    }
    reservedKey = key;
  }

  const connection = await deps.connect();
  if (!connection.ok) {
    // Nothing ran: the reservation is let go at once, so the account is free again.
    if (reservedKey) await deps.finish(reservedKey, null).catch(() => undefined);
    if (connection.code === "running_limit") return { error: connection.error, status: "busy" };
    return failed(connection.error);
  }

  let client = deps.open(connection.url);
  const turnKey: string | null = input.resume?.turnKey ?? reservedKey;
  let threadId: string | null = input.resume?.threadId ?? null;
  let turnId: string | null = input.resume?.turnId ?? null;
  const heartbeat = deps.alive ? setInterval(() => void deps.alive?.().catch(() => undefined), 30_000) : null;

  // What the runtime says about the turn: when it ends, and Tensor's last words in it. Heard from
  // before the turn is started, since a short turn can end before turn/start answers.
  const ended = new Map<string, Turn>();
  const said = new Map<string, string>();
  const hear = ({ method, params }: RuntimeNotification) => {
    if (params.threadId !== undefined && params.threadId !== threadId) return;
    if (method === "turn/completed") {
      const turn = params.turn as Turn;
      if (turn?.id) ended.set(turn.id, turn);
    } else if (method === "item/completed") {
      const item = params.item as { type?: string; text?: string };
      if (item?.type === "agentMessage" && typeof item.text === "string" && item.text.trim() && typeof params.turnId === "string") {
        said.set(params.turnId, item.text.trim());
      }
    }
  };
  /** Looks at the turn in the conversation as the runtime keeps it, and notes it if it has ended. */
  const look = async () => {
    const reopened = await client.request<{ thread: Thread }>("thread/resume", {
      approvalPolicy: "never",
      config: THREAD_CONFIG,
      threadId,
    });
    const turn = reopened.thread.turns.find((one) => one.id === turnId);
    if (turn && turn.status !== "inProgress") {
      ended.set(turn.id, turn);
      const words = lastWords(turn.items);
      if (words) said.set(turn.id, words);
    }
    return turn ?? null;
  };

  try {
    await client.ready;
    client.listen(hear);

    if (input.resume) {
      // Picked up from a server that went away: the turn is wherever it got to.
      if (!(await look())) return failed("The turn could not be found in the project.", threadId, turnId);
    } else {
      // The project's background conversation, or a new one if it has none (or it is gone).
      let thread: { thread: Thread; model: string } | null = null;
      if (input.threadId) {
        thread = await client
          .request<{ thread: Thread; model: string }>("thread/resume", {
            approvalPolicy: "never",
            config: THREAD_CONFIG,
            threadId: input.threadId,
          })
          .catch(() => null);
      }
      thread ??= await client.request<{ thread: Thread; model: string }>("thread/start", {
        approvalPolicy: "never",
        config: THREAD_CONFIG,
        cwd: WORKSPACE,
        sandbox: "workspace-write",
      });
      threadId = thread.thread.id;

      const started = await client.request<{ turn: Turn }>("turn/start", {
        input: [{ text: input.prompt, text_elements: [], type: "text" }],
        // The project's machine is the sandbox, as on the web: it may commit, and reach the network.
        sandboxPolicy: { networkAccess: "enabled", type: "externalSandbox" },
        threadId,
      });
      turnId = started.turn.id;
      if (turnKey) await deps.started?.({ threadId, turnId, turnKey });
    }
    if (!turnId) return failed("The turn did not start.", threadId);

    const deadline = (input.resume?.startedAt ?? Date.now()) + (deps.turnTimeoutMs ?? TURN_TIMEOUT_MS);
    let reconnects = 0;
    for (;;) {
      if (ended.has(turnId)) break;
      const left = deadline - Date.now();
      const outcome = await Promise.race([
        new Promise<"ended">((resolve) => {
          const check = setInterval(() => {
            if (ended.has(turnId as string)) {
              clearInterval(check);
              resolve("ended");
            }
          }, 250);
          void client.closed.then(() => clearInterval(check));
        }),
        client.closed.then(() => "closed" as const),
        sleep(Math.max(0, left)).then(() => "timeout" as const),
      ]);
      if (outcome === "ended") break;
      if (outcome === "timeout") {
        await client.request("turn/interrupt", { threadId, turnId }, 15_000).catch(() => undefined);
        for (let waited = 0; waited < 5_000 && !ended.has(turnId); waited += 250) await sleep(250);
        if (!ended.has(turnId)) return { error: "The turn took too long and was stopped.", reply: said.get(turnId) ?? null, status: "interrupted", threadId, turnId };
        break;
      }
      // The connection dropped; the turn goes on on the machine. Open it again and look.
      if (++reconnects > RECONNECTS) return failed("The connection to the project kept dropping.", threadId, turnId);
      await sleep(deps.reconnectDelayMs ?? 3_000);
      const again = await deps.connect();
      if (!again.ok) continue;
      client = deps.open(again.url);
      try {
        await client.ready;
        client.listen(hear);
        await look();
      } catch {
        // Tried again on the next pass.
      }
    }

    const turn = ended.get(turnId) as Turn;
    return {
      error: turn.status === "completed" ? null : turn.error?.message ?? `The turn ended ${turn.status}.`,
      reply: said.get(turnId) ?? lastWords(turn.items),
      status: turn.status === "inProgress" ? "failed" : turn.status,
      threadId,
      turnId,
    };
  } catch (error) {
    return failed(error instanceof Error ? error.message : "Tensor could not run the turn.", threadId, turnId);
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    client.close();
    if (turnKey) {
      // The reservation is closed and the project told the turn is over, whatever happened.
      await deps.finish(turnKey, turnId).catch((error) => console.error("[Tensor Background] Closing a reservation failed", error));
      await deps.turnEnded().catch(() => undefined);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// On record

export type BackgroundTurnRow = {
  id: string;
  task_id: string;
  user_id: string;
  source: string;
  status: "queued" | "running" | "completed" | "failed" | "interrupted" | "busy";
  prompt: string;
  thread_id: string | null;
  turn_id: string | null;
  turn_key: string | null;
  heartbeat_at?: string;
  reply: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export async function queueBackgroundTurn(
  admin: Admin,
  input: { userId: string; taskId: string; prompt: string; source: string },
): Promise<BackgroundTurnRow> {
  const { data, error } = await admin
    .from(TABLE)
    .insert({ prompt: input.prompt, source: input.source, task_id: input.taskId, user_id: input.userId })
    .select("*")
    .single();
  if (error) throw error;
  return data as BackgroundTurnRow;
}

export async function readBackgroundTurn(admin: Admin, userId: string, id: string): Promise<BackgroundTurnRow | null> {
  const { data, error } = await admin.from(TABLE).select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as BackgroundTurnRow | null) ?? null;
}

async function updateRow(admin: Admin, id: string, patch: Partial<BackgroundTurnRow>): Promise<void> {
  const { error } = await admin.from(TABLE).update(patch).eq("id", id);
  if (error) throw error;
}

/** The project's background conversation so far: the last one a background turn used. */
async function backgroundThread(admin: Admin, taskId: string): Promise<string | null> {
  const { data } = await admin
    .from(TABLE)
    .select("thread_id")
    .eq("task_id", taskId)
    .not("thread_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { thread_id: string | null } | null)?.thread_id ?? null;
}

/** How long a busy account is waited for, and how often it is asked again. */
const BUSY_WAIT_MS = 12 * 60 * 60_000;
const BUSY_RETRY_MS = 30_000;

/**
 * Runs a queued turn to its end and keeps how it went; or, for a row whose turn had started
 * when its server went away, follows that turn to its end and closes its reservation.
 *
 * An account that is busy (Tensor working in a chat) is asked again every half minute: the
 * comment waits its turn, for up to twelve hours. All the while the row's heartbeat says this
 * server has it, so a sweep (lib/tensor-background-sweep.ts) takes over only a row nobody has.
 */
export async function runBackgroundTurn(
  admin: Admin,
  cloud: TensorCloudConfig,
  row: BackgroundTurnRow,
  overrides: Partial<BackgroundTurnDeps> = {},
): Promise<BackgroundTurnResult> {
  const alive = () => updateRow(admin, row.id, { heartbeat_at: new Date().toISOString() });
  const deps: BackgroundTurnDeps = {
    alive,
    connect: () => connectSandbox(admin, cloud, row.user_id, row.task_id),
    finish: (key, turnId) => finishTensorTurn(admin, row.user_id, key, turnId),
    open: (url) => new RuntimeClient(url, ORIGIN),
    reserve: (key, model) => reserveTensorTurn(admin, row.user_id, key, model),
    started: ({ threadId, turnId, turnKey }) =>
      updateRow(admin, row.id, {
        heartbeat_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        status: "running",
        thread_id: threadId,
        turn_id: turnId,
        turn_key: turnKey,
      }),
    turnEnded: () => noteTurnEnded(admin, row.task_id),
    ...overrides,
  };

  const resume =
    row.status === "running" && row.thread_id && row.turn_id && row.turn_key
      ? {
          startedAt: Date.parse(row.started_at ?? row.created_at),
          threadId: row.thread_id,
          turnId: row.turn_id,
          turnKey: row.turn_key,
        }
      : undefined;
  const giveUpAt = Date.parse(row.created_at) + BUSY_WAIT_MS;
  let result: BackgroundTurnResult;
  try {
    const threadId = resume ? null : await backgroundThread(admin, row.task_id);
    for (;;) {
      result = await driveBackgroundTurn({ prompt: row.prompt, resume, taskId: row.task_id, threadId, userId: row.user_id }, deps);
      if (result.status !== "busy" || Date.now() > giveUpAt) break;
      await alive().catch(() => undefined);
      await sleep(overrides.reconnectDelayMs ?? BUSY_RETRY_MS);
    }
  } catch (error) {
    result = failed(error instanceof Error ? error.message : "Tensor could not run the turn.");
  }

  await updateRow(admin, row.id, {
    error: result.error,
    finished_at: new Date().toISOString(),
    status: result.status,
    turn_key: null,
    ...(result.status === "busy" ? {} : { reply: result.reply, thread_id: result.threadId, turn_id: result.turnId }),
  }).catch((error) => console.error("[Tensor Background] Keeping how a turn went failed", error));
  return result;
}

/** A turn with nobody following it: its heartbeat has been quiet this long. */
export const ORPHANED_AFTER_MS = 5 * 60_000;

/**
 * Takes over turns whose server went away (a deploy or restart): a queued one is run, a running
 * one followed to its end and its reservation closed. A row is claimed by freshening its
 * heartbeat only if it is still quiet, so two servers never take the same one.
 */
export async function adoptOrphanedTurns(
  admin: Admin,
  cloud: TensorCloudConfig,
  run: (row: BackgroundTurnRow) => Promise<unknown> = (row) => runBackgroundTurn(admin, cloud, row),
): Promise<number> {
  const quiet = new Date(Date.now() - ORPHANED_AFTER_MS).toISOString();
  const { data, error } = await admin
    .from(TABLE)
    .select("*")
    .in("status", ["queued", "running"])
    .lt("heartbeat_at", quiet)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw error;
  let adopted = 0;
  for (const row of (data ?? []) as BackgroundTurnRow[]) {
    const { data: claimed } = await admin
      .from(TABLE)
      .update({ heartbeat_at: new Date().toISOString() })
      .eq("id", row.id)
      .in("status", ["queued", "running"])
      .lt("heartbeat_at", quiet)
      .select("id");
    if (!claimed || claimed.length === 0) continue;
    adopted += 1;
    void run(row).catch((failure) => console.error("[Tensor Background] An adopted turn failed", failure));
  }
  return adopted;
}

export type SiteChange = { id: string; at: string; asked: string[]; did: string | null; status: string };

/**
 * What Tensor did lately from comments on the published app, newest first: what was asked, and
 * Tensor's own note on what it did. A chat is handed these, so "the copyright change" can be
 * found and undone from there without naming where it was asked for.
 */
export async function recentSiteChanges(admin: Admin, userId: string, taskId: string, days = 7): Promise<SiteChange[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await admin
    .from(TABLE)
    .select("id, status, reply, finished_at")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .eq("source", "quality")
    .in("status", ["completed", "failed", "interrupted"])
    .gte("finished_at", since)
    .order("finished_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  const turns = (data ?? []) as Array<{ id: string; status: string; reply: string | null; finished_at: string }>;
  if (turns.length === 0) return [];
  const { data: comments, error: commentsError } = await admin
    .from("tensor_cloud_quality_comments")
    .select("background_turn_id, content, received_at")
    .in("background_turn_id", turns.map((turn) => turn.id))
    .order("received_at", { ascending: true });
  if (commentsError) throw commentsError;
  const asked = new Map<string, string[]>();
  for (const comment of (comments ?? []) as Array<{ background_turn_id: string; content: string }>) {
    asked.set(comment.background_turn_id, [...(asked.get(comment.background_turn_id) ?? []), comment.content]);
  }
  return turns.map((turn) => ({ asked: asked.get(turn.id) ?? [], at: turn.finished_at, did: turn.reply, id: turn.id, status: turn.status }));
}

export type BackgroundWork = { taskId: string; title: string | null; asked: string[]; source: string; startedAt: string | null };

/**
 * What Tensor is doing for the account with no page open, if anything: so a chat whose message
 * has to wait can say what for, in its own words, instead of refusing it.
 */
export async function runningBackgroundWork(admin: Admin, userId: string): Promise<BackgroundWork | null> {
  const fresh = new Date(Date.now() - ORPHANED_AFTER_MS).toISOString();
  const { data, error } = await admin
    .from(TABLE)
    .select("id, task_id, source, started_at")
    .eq("user_id", userId)
    .eq("status", "running")
    .gte("heartbeat_at", fresh)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const row = data as { id: string; task_id: string; source: string; started_at: string | null } | null;
  if (!row) return null;
  const [{ data: task }, { data: comments }] = await Promise.all([
    admin.from("tensor_cloud_tasks").select("title, project_name").eq("id", row.task_id).maybeSingle(),
    admin
      .from("tensor_cloud_quality_comments")
      .select("content, received_at")
      .eq("background_turn_id", row.id)
      .order("received_at", { ascending: true }),
  ]);
  const named = task as { title?: string | null; project_name?: string | null } | null;
  return {
    asked: ((comments ?? []) as Array<{ content: string }>).map((comment) => comment.content),
    source: row.source,
    startedAt: row.started_at,
    taskId: row.task_id,
    title: named?.title || named?.project_name || null,
  };
}


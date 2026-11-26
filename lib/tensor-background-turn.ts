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

/** Runs one turn in a project, from waking its machine to closing its reservation. */
export async function driveBackgroundTurn(input: BackgroundTurnInput, deps: BackgroundTurnDeps): Promise<BackgroundTurnResult> {
  const connection = await deps.connect();
  if (!connection.ok) {
    if (connection.code === "running_limit") return { error: connection.error, status: "busy" };
    return failed(connection.error);
  }

  let client = deps.open(connection.url);
  let turnKey: string | null = null;
  let threadId: string | null = null;
  let turnId: string | null = null;
  try {
    await client.ready;

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

    // Model calls are served only under an open reservation; one turn at a time per account.
    const key = randomUUID();
    const reservation = await deps.reserve(key, thread.model ?? null);
    if (!reservation.allowed) {
      if (reservation.reason === "concurrency_limit") return { error: "Tensor is working on something else for this account.", status: "busy" };
      return failed(
        reservation.reason === "task_limit" || reservation.reason === "trial_limit" || reservation.reason === "pass_budget_limit"
          ? "The account has used its allowance for now."
          : "Tensor could not reserve usage for this turn.",
        threadId,
      );
    }
    turnKey = key;

    // Heard from before the turn is started: a short turn can end before turn/start answers.
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
    client.listen(hear);

    const started = await client.request<{ turn: Turn }>("turn/start", {
      input: [{ text: input.prompt, text_elements: [], type: "text" }],
      // The project's machine is the sandbox, as on the web: it may commit, and reach the network.
      sandboxPolicy: { networkAccess: "enabled", type: "externalSandbox" },
      threadId,
    });
    turnId = started.turn.id;
    await deps.started?.({ threadId, turnId, turnKey });

    const deadline = Date.now() + (deps.turnTimeoutMs ?? TURN_TIMEOUT_MS);
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
const BUSY_WAIT_MS = 30 * 60_000;
const BUSY_RETRY_MS = 30_000;

/**
 * Runs a queued turn to its end and keeps how it went. An account that is busy (Tensor working in
 * a chat) is asked again every half minute for up to half an hour: the comment waits its turn.
 */
export async function runBackgroundTurn(
  admin: Admin,
  cloud: TensorCloudConfig,
  row: BackgroundTurnRow,
  overrides: Partial<BackgroundTurnDeps> = {},
): Promise<BackgroundTurnResult> {
  const deps: BackgroundTurnDeps = {
    connect: () => connectSandbox(admin, cloud, row.user_id, row.task_id),
    finish: (key, turnId) => finishTensorTurn(admin, row.user_id, key, turnId),
    open: (url) => new RuntimeClient(url, ORIGIN),
    reserve: (key, model) => reserveTensorTurn(admin, row.user_id, key, model),
    started: ({ threadId, turnId, turnKey }) =>
      updateRow(admin, row.id, { started_at: new Date().toISOString(), status: "running", thread_id: threadId, turn_id: turnId, turn_key: turnKey }),
    turnEnded: () => noteTurnEnded(admin, row.task_id),
    ...overrides,
  };

  const giveUpAt = Date.now() + BUSY_WAIT_MS;
  let result: BackgroundTurnResult;
  try {
    const threadId = await backgroundThread(admin, row.task_id);
    for (;;) {
      result = await driveBackgroundTurn({ prompt: row.prompt, taskId: row.task_id, threadId, userId: row.user_id }, deps);
      if (result.status !== "busy" || Date.now() > giveUpAt) break;
      await sleep(BUSY_RETRY_MS);
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

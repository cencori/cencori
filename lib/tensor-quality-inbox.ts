import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { createAdminClient } from "@/lib/supabaseAdmin";
import { queueBackgroundTurn, runBackgroundTurn, type BackgroundTurnRow } from "@/lib/tensor-background-turn";
import type { TensorCloudConfig } from "@/lib/tensor-cloud";

/**
 * Tensor as a teammate on the published app: a comment its owner leaves there with Quality is
 * picked up and fixed with nobody opening Tensor.
 *
 * Quality's webhook (app/api/tensor/quality/webhook) hands each new thread and reply here. Only
 * the project's owner's comments are acted on, and only with "fix my comments" on: a visitor's
 * comment (Quality's "Anyone" mode) never runs the agent, or anyone could edit the site and spend
 * the owner's credits by typing. A comment waits until 30 seconds pass with no other from them, so
 * a burst of comments is one turn, and one publish.
 *
 * Docs: https://docs.usequality.app/docs/connect/script/cencori (Step 9, webhooks).
 */

type Admin = ReturnType<typeof createAdminClient>;

const COMMENTS = "tensor_cloud_quality_comments";
const BACKGROUND = "tensor_cloud_background_turns";
/** How long Tensor waits after a comment for others that follow it. */
export const QUIET_MS = 30_000;
/** How old a signed event may be. */
const SIGNATURE_TOLERANCE_S = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------------------------
// The webhook

/**
 * Whether an event really came from Quality: `Quality-Signature: t=<unix seconds>,v1=<hex>`,
 * an HMAC-SHA256 of `${t}.${raw body}` with the webhook's secret, made in the last five minutes.
 */
export function verifyQualitySignature(secret: string, header: string | null, rawBody: string, now = Date.now()): boolean {
  if (!header) return false;
  const parts = new Map(
    header.split(",").map((part) => {
      const at = part.indexOf("=");
      return [part.slice(0, at).trim(), part.slice(at + 1).trim()] as const;
    }),
  );
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1 || !/^\d+$/.test(t) || !/^[0-9a-f]+$/i.test(v1)) return false;
  if (Math.abs(now / 1000 - Number(t)) > SIGNATURE_TOLERANCE_S) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const given = Buffer.from(v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type QualityEvent = {
  id: string;
  type: string;
  created_at?: string;
  team_id?: string;
  project_id?: string;
  thread?: { id?: string; status?: string; page_url?: string; page_title?: string };
  comment?: { id?: string; content?: string; author?: { id?: string; name?: string } };
};

/** A comment as plain text: Quality sends HTML. */
export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type Received = { kept: false; why: string } | { kept: true; taskId: string };

/**
 * Keeps a new thread or reply for Tensor to act on, if it is the project's owner's and they have
 * "fix my comments" on. Safe to receive the same event again.
 */
export async function receiveQualityEvent(admin: Admin, event: QualityEvent): Promise<Received> {
  if (event.type !== "thread.created" && event.type !== "comment.created") return { kept: false, why: "not a comment" };
  const taskId = event.project_id;
  const threadId = event.thread?.id;
  const content = plainText(event.comment?.content ?? "");
  if (!taskId || !UUID.test(taskId) || !threadId || !content) return { kept: false, why: "incomplete" };

  const { data: link, error } = await admin
    .from("tensor_cloud_quality")
    .select("task_id, user_id, auto_fix")
    .eq("task_id", taskId)
    .maybeSingle();
  if (error) throw error;
  const quality = link as { task_id: string; user_id: string; auto_fix: boolean } | null;
  if (!quality || quality.user_id !== event.team_id) return { kept: false, why: "not a Tensor project with Quality on" };
  if (!quality.auto_fix) return { kept: false, why: "fixing comments is off" };
  // Members are synced to Quality with their Tensor ids, so the owner's comments carry theirs.
  if (event.comment?.author?.id !== quality.user_id) return { kept: false, why: "not the owner's comment" };

  const { error: kept } = await admin.from(COMMENTS).upsert(
    {
      author_id: event.comment?.author?.id ?? null,
      author_name: event.comment?.author?.name?.slice(0, 200) ?? null,
      comment_id: event.comment?.id ?? null,
      content: content.slice(0, 4000),
      event_id: event.id,
      page_title: event.thread?.page_title?.slice(0, 300) ?? null,
      page_url: event.thread?.page_url?.slice(0, 2000) ?? null,
      task_id: taskId,
      thread_id: threadId,
      user_id: quality.user_id,
    },
    { ignoreDuplicates: true, onConflict: "event_id" },
  );
  if (kept) throw kept;
  return { kept: true, taskId };
}

// ---------------------------------------------------------------------------------------------
// Acting on them

export type WaitingComment = {
  event_id: string;
  task_id: string;
  user_id: string;
  thread_id: string;
  content: string;
  page_url: string | null;
  page_title: string | null;
  received_at: string;
};

/** What Tensor is asked to do: the owner's comments, as a request from them, and how to finish. */
export function commentsPrompt(comments: WaitingComment[]): string {
  const site = comments.map((comment) => comment.page_url).find(Boolean);
  let origin: string | null = null;
  try {
    origin = site ? new URL(site).origin : null;
  } catch {
    origin = null;
  }
  const one = comments.length === 1;
  // Replies in one thread read together, in the order they were left.
  const threads = new Map<string, WaitingComment[]>();
  for (const comment of comments) threads.set(comment.thread_id, [...(threads.get(comment.thread_id) ?? []), comment]);
  const listed = [...threads.entries()].map(([thread, said]) => {
    const page = said[0].page_title || said[0].page_url || "the site";
    const where = said[0].page_url && said[0].page_title ? `${said[0].page_title} (${said[0].page_url})` : page;
    return `- On ${where}, thread ${thread}:\n${said.map((comment) => `  "${comment.content.replace(/\n+/g, " ")}"`).join("\n")}`;
  });

  return [
    `The owner of this project just left ${one ? "a comment" : `${comments.length} comments`} on the published app${origin ? ` at ${origin}` : ""}, with the feedback button on the site. Treat ${one ? "it" : "them"} as the owner asking you directly. Nobody is watching this conversation: they expect to come back and find it done.`,
    "",
    ...listed,
    "",
    "For each thread, first run `node /data/home/tools/tensor.mjs feedback THREAD_ID` to see exactly which element they pinned it to and what the page was doing, then make the change.",
    "- Commit each change on its own as soon as it works, with a plain message that says what changed and that it was asked for on the site, such as \"Centre the footer copyright line (asked for on the site)\". These commits are how the change is found and undone later.",
    "- When everything is done and works, publish with `node /data/home/tools/tensor.mjs publish`. They asked for these changes on the live site, so publishing them is what they want.",
    "- If a comment is unclear, or needs something only they can give (a key, a choice between options), do not guess: leave it and say why.",
    "- A comment that asks a question and asks for no change: answer it and change nothing.",
    "",
    "Finish with a short note to them, one plain sentence per comment on what you did (or why not), as you would tell a teammate. Do not quote the comments back.",
  ].join("\n");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitingComments(admin: Admin, taskId: string): Promise<WaitingComment[]> {
  const { data, error } = await admin
    .from(COMMENTS)
    .select("event_id, task_id, user_id, thread_id, content, page_url, page_title, received_at")
    .eq("task_id", taskId)
    .is("background_turn_id", null)
    .order("received_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as WaitingComment[];
}

/**
 * Called after each kept comment: waits for the owner to stop commenting, then hands everything
 * waiting in the project to one background turn. When a later comment arrives in the meantime,
 * this one leaves it to that comment's own call, which waits again.
 */
export async function takeUpComments(
  admin: Admin,
  cloud: TensorCloudConfig,
  taskId: string,
  options: { quietMs?: number; run?: (row: BackgroundTurnRow) => Promise<unknown>; wait?: boolean } = {},
): Promise<BackgroundTurnRow | null> {
  const quietMs = options.quietMs ?? QUIET_MS;
  if (quietMs > 0 && options.wait !== false) await sleep(quietMs);

  const waiting = await waitingComments(admin, taskId);
  if (waiting.length === 0) return null;
  const newest = Date.parse(waiting.at(-1)?.received_at ?? "");
  if (Number.isFinite(newest) && Date.now() - newest < quietMs - 1_000) return null;

  // The turn is put on record first, then the comments claimed for it; another call that got
  // here at the same moment claims none, and its turn is taken back.
  const row = await queueBackgroundTurn(admin, {
    prompt: commentsPrompt(waiting),
    source: "quality",
    taskId,
    userId: waiting[0].user_id,
  });
  const { data: claimed, error } = await admin
    .from(COMMENTS)
    .update({ background_turn_id: row.id })
    .in("event_id", waiting.map((comment) => comment.event_id))
    .is("background_turn_id", null)
    .select("event_id, task_id, user_id, thread_id, content, page_url, page_title, received_at");
  if (error) throw error;
  const mine = ((claimed ?? []) as WaitingComment[]).sort((a, b) => a.received_at.localeCompare(b.received_at));
  if (mine.length === 0) {
    await admin.from(BACKGROUND).delete().eq("id", row.id);
    return null;
  }
  if (mine.length !== waiting.length) {
    row.prompt = commentsPrompt(mine);
    await admin.from(BACKGROUND).update({ prompt: row.prompt }).eq("id", row.id);
  }

  await (options.run ?? ((queued) => runBackgroundTurn(admin, cloud, queued)))(row);
  return row;
}

/**
 * Comments left waiting longer than they should have been: the server restarted while it
 * waited for the owner to stop commenting. Taken up now, a project at a time.
 */
export async function sweepQualityInbox(admin: Admin, cloud: TensorCloudConfig): Promise<number> {
  const before = new Date(Date.now() - QUIET_MS * 3).toISOString();
  const { data, error } = await admin
    .from(COMMENTS)
    .select("task_id")
    .is("background_turn_id", null)
    .lt("received_at", before)
    .limit(100);
  if (error) throw error;
  const tasks = [...new Set(((data ?? []) as Array<{ task_id: string }>).map((row) => row.task_id))];
  for (const taskId of tasks) {
    void takeUpComments(admin, cloud, taskId, { quietMs: 0 }).catch((failure) =>
      console.error("[Tensor Quality] Taking up waiting comments failed", failure),
    );
  }
  return tasks.length;
}

// ---------------------------------------------------------------------------------------------
// The setting

export async function setQualityAutoFix(admin: Admin, taskId: string, on: boolean): Promise<void> {
  const { error } = await admin.from("tensor_cloud_quality").update({ auto_fix: on }).eq("task_id", taskId);
  if (error) throw error;
}

export async function readQualityAutoFix(admin: Admin, taskId: string): Promise<boolean> {
  const { data, error } = await admin.from("tensor_cloud_quality").select("auto_fix").eq("task_id", taskId).maybeSingle();
  if (error) throw error;
  return (data as { auto_fix?: boolean } | null)?.auto_fix ?? true;
}

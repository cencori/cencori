import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { POST as inference } from "@/app/api/tensor/inference/v1/[...path]/route";
import { invalidateTensorAccess, setCachedTensorAccess } from "@/lib/config-cache";
import { noStoreHeaders } from "@/lib/tensor-auth";
import {
  PLAIN_CHAT_MESSAGE_MAX,
  addPlainMessage,
  contextMessages,
  plainChatInstructions,
  plainMessageJson,
  readPlainChat,
  readPlainMessages,
  titleFromMessage,
  updatePlainChat,
  type ProjectSummary,
} from "@/lib/tensor-chats";
import { authenticateTensorDataRequest } from "@/lib/tensor-data";
import { gatewayEntitlementFrom } from "@/lib/tensor-entitlement";

/** The model a plain chat answers with: the one the web's project chats use, open to every plan. */
const CHAT_MODEL = "maximo-atlas-1.5";
/** How long one answer may go on. */
const ANSWER_MAX_TOKENS = 4096;

export const maxDuration = 300;

type Context = { params: Promise<{ chatId: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

/**
 * Sends a message in a plain chat and streams the answer.
 *
 * The answer is one model call through Tensor's own inference route, so the plan's model rules and
 * its billing apply exactly as they do to the app. The call runs inside a chat turn: reserved
 * before, finished after, billed by its cost against the month's ceiling and not as a task.
 *
 * The response is newline-delimited JSON: `{type:"message"}` (the person's message, as saved),
 * then `{type:"delta", text}` as the answer arrives, then `{type:"done", message}`, or
 * `{type:"error", code, error}`. The answer is saved as far as it got, even when the reader leaves.
 */
export async function POST(request: NextRequest, context: Context) {
  const authorization = request.headers.get("authorization");
  const session = await authenticateTensorDataRequest(authorization);
  if (!session || !authorization) return json({ error: "Your Cencori session is invalid." }, 401);

  let text = "";
  try {
    const body = (await request.json()) as { content?: unknown };
    text = typeof body.content === "string" ? body.content.trim() : "";
  } catch {
    return json({ error: "That request is invalid." }, 400);
  }
  if (!text) return json({ error: "Write a message first." }, 400);
  if (text.length > PLAIN_CHAT_MESSAGE_MAX) {
    return json({ error: "That message is too long to send." }, 413);
  }

  const { admin, user } = session;
  const chat = await readPlainChat(admin, user.id, (await context.params).chatId).catch(() => null);
  if (!chat) return json({ error: "That chat does not exist." }, 404);

  // The turn first: a message that cannot be answered is not kept.
  const turnKey = randomUUID();
  const { data: reservation, error: reserveError } = await admin.rpc("basecode_reserve_turn", {
    p_user_id: user.id,
    p_client_turn_key: turnKey,
    p_model: CHAT_MODEL,
    p_kind: "chat",
  });
  if (reserveError) {
    console.error("[Tensor Chats] Reserving a chat turn failed", reserveError);
    return json({ error: "Tensor could not reserve usage for this message.", code: "usage_unavailable" }, 503);
  }
  const reserved = reservation as { allowed?: boolean; reason?: string; reset_at?: string | null } | null;
  if (!reserved?.allowed) {
    return json(
      {
        error: "You have used this month's allowance.",
        code: reserved?.reason ?? "usage_limit",
        resetAt: reserved?.reset_at ?? null,
      },
      429,
    );
  }
  const entitlement = gatewayEntitlementFrom(reserved);
  if (entitlement) await setCachedTensorAccess(user.id, entitlement);

  const finish = async () => {
    const { error } = await admin.rpc("basecode_finish_turn", {
      p_user_id: user.id,
      p_client_turn_key: turnKey,
      p_runtime_turn_id: null,
    });
    if (error) console.error("[Tensor Chats] Finishing a chat turn failed", error);
    await invalidateTensorAccess(user.id);
  };

  let history: Awaited<ReturnType<typeof readPlainMessages>>;
  let saved: Awaited<ReturnType<typeof addPlainMessage>>;
  let projects: ProjectSummary[];
  try {
    [history, projects] = await Promise.all([readPlainMessages(admin, chat.id), readProjects(admin, user.id)]);
    saved = await addPlainMessage(admin, { chatId: chat.id, userId: user.id, role: "user", content: text });
    await updatePlainChat(admin, chat.id, history.length === 0 && !chat.title ? { title: titleFromMessage(text) } : { touch: true });
  } catch (error) {
    console.error("[Tensor Chats] Saving a message failed", error);
    await finish();
    return json({ error: "Tensor could not save your message." }, 503);
  }

  const upstreamAbort = new AbortController();
  const upstream = await inference(
    new NextRequest(`${new URL(request.url).origin}/api/tensor/inference/v1/chat/completions`, {
      method: "POST",
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify({
        model: CHAT_MODEL,
        stream: true,
        max_tokens: ANSWER_MAX_TOKENS,
        messages: [
          { role: "system", content: plainChatInstructions(projects, new Date()) },
          ...contextMessages([...history, saved]),
        ],
      }),
      signal: upstreamAbort.signal,
    }),
    { params: Promise.resolve({ path: ["chat", "completions"] }) },
  ).catch((error: unknown) => {
    console.error("[Tensor Chats] The model call failed", error);
    return null;
  });

  const encoder = new TextEncoder();
  const line = (value: unknown) => encoder.encode(`${JSON.stringify(value)}\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (value: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(line(value));
        } catch {
          open = false;
        }
      };
      // The reader leaving stops the answer where it is: nothing more is generated or billed.
      const onAbort = () => upstreamAbort.abort();
      request.signal.addEventListener("abort", onAbort);

      send({ type: "message", message: plainMessageJson(saved) });

      let answer = "";
      let status: "complete" | "stopped" | "failed" = "complete";
      let failure: { code: string; error: string } | null = null;

      if (!upstream || !upstream.ok || !upstream.body) {
        status = "failed";
        failure = await upstreamFailure(upstream);
      } else {
        try {
          for await (const delta of readDeltas(upstream.body, upstreamAbort.signal)) {
            answer += delta;
            send({ type: "delta", text: delta });
          }
        } catch (error) {
          if (upstreamAbort.signal.aborted) status = "stopped";
          else {
            console.error("[Tensor Chats] The answer broke off", error);
            status = "failed";
            failure = { code: "answer_interrupted", error: "The answer was cut short. Try again." };
          }
        }
      }
      request.signal.removeEventListener("abort", onAbort);

      try {
        if (answer || status !== "failed") {
          const message = await addPlainMessage(admin, {
            chatId: chat.id,
            userId: user.id,
            role: "assistant",
            content: answer,
            status,
            model: CHAT_MODEL,
          });
          if (status === "failed" && failure) send({ type: "error", ...failure, message: plainMessageJson(message) });
          else send({ type: "done", message: plainMessageJson(message) });
        } else if (failure) {
          send({ type: "error", ...failure });
        }
      } catch (error) {
        console.error("[Tensor Chats] Saving an answer failed", error);
        send({ type: "error", code: "save_failed", error: "Tensor could not save its answer." });
      }
      await finish();
      if (open) {
        try {
          controller.close();
        } catch {
          // Already closed by the reader leaving.
        }
      }
    },
    cancel() {
      upstreamAbort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      ...noStoreHeaders(),
      "content-type": "application/x-ndjson; charset=utf-8",
      "x-accel-buffering": "no",
    },
  });
}

/** The text of a streamed chat completion, piece by piece. */
async function* readDeltas(body: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader();
  // Stopping cancels the stream itself, so the model stops generating, not only the reading.
  const stop = () => void reader.cancel().catch(() => {});
  signal.addEventListener("abort", stop);
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (signal.aborted) throw new Error("stopped");
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end = buffer.indexOf("\n");
      while (end !== -1) {
        const raw = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        end = buffer.indexOf("\n");
        if (!raw.startsWith("data:")) continue;
        const data = raw.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let parsed: { choices?: { delta?: { content?: unknown } }[]; error?: { message?: unknown } };
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        if (parsed.error) throw new Error(String(parsed.error.message ?? "upstream_error"));
        const content = parsed.choices?.[0]?.delta?.content;
        if (typeof content === "string" && content) yield content;
      }
    }
  } finally {
    signal.removeEventListener("abort", stop);
    reader.releaseLock();
  }
}

/** What to tell the person when the model call itself was refused. */
async function upstreamFailure(response: Response | null): Promise<{ code: string; error: string }> {
  if (!response) return { code: "upstream_unavailable", error: "Tensor could not reach its model. Try again." };
  let code = "upstream_error";
  try {
    const body = (await response.json()) as { code?: unknown };
    if (typeof body.code === "string") code = body.code;
  } catch {
    // Not JSON; the status says enough.
  }
  if (response.status === 429 || response.status === 402) {
    return { code, error: "You have used this month's allowance." };
  }
  return { code, error: "Tensor could not answer just now. Try again." };
}

/** The account's projects, by name, for Tensor to know what the person is already building. */
async function readProjects(
  admin: Parameters<typeof readPlainMessages>[0],
  userId: string,
): Promise<ProjectSummary[]> {
  const [{ data: tasks }, { data: deployments }] = await Promise.all([
    admin
      .from("tensor_cloud_tasks")
      .select("id, project_name")
      .eq("user_id", userId)
      .not("project_name", "is", null)
      .is("archived_at", null)
      .not("status", "in", "(deleted,failed,spare)")
      .order("updated_at", { ascending: false })
      .limit(30),
    admin.from("tensor_cloud_deployments").select("task_id, published_at").eq("user_id", userId),
  ]);
  const published = new Set(
    (deployments ?? []).filter((row) => row.published_at).map((row) => row.task_id as string),
  );
  return (tasks ?? []).map((task) => ({
    name: String(task.project_name),
    published: published.has(task.id as string),
  }));
}

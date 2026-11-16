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
import { readStream, searchQuery, type ChatMessage, type ToolCall } from "@/lib/tensor-chats-stream";
import { authenticateTensorDataRequest } from "@/lib/tensor-data";
import { gatewayEntitlementFrom } from "@/lib/tensor-entitlement";
import { liveWebSearch, takeWebSearchSlot } from "@/lib/web/live-search";
import { WEB_PRICES_USD } from "@/lib/web/pricing";

/** The model a plain chat answers with: the one the web's project chats use, open to every plan. */
const CHAT_MODEL = "maximo-atlas-1.5";
/** How long one answer may go on. */
const ANSWER_MAX_TOKENS = 4096;
/** Searches one message may make, and results each brings back. */
const MAX_SEARCHES = 3;
const SEARCH_RESULTS = 6;

/** The one tool a plain chat has: searching the live web. */
const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the live web. Use it for anything current (news, prices, releases, events, people's current roles), for facts you are not sure of, and when asked to look something up. Returns titles, links and snippets.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "What to search for, as you would type it into a search engine." } },
      required: ["query"],
    },
  },
} as const;

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
  const origin = new URL(request.url).origin;
  /** One model call: the conversation so far, with the search tool while searches remain. */
  const callModel = (messages: ChatMessage[], withSearch: boolean) =>
    inference(
      new NextRequest(`${origin}/api/tensor/inference/v1/chat/completions`, {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: JSON.stringify({
          model: CHAT_MODEL,
          stream: true,
          max_tokens: ANSWER_MAX_TOKENS,
          messages,
          ...(withSearch ? { tools: [WEB_SEARCH_TOOL], tool_choice: "auto" } : {}),
        }),
        signal: upstreamAbort.signal,
      }),
      { params: Promise.resolve({ path: ["chat", "completions"] }) },
    ).catch((error: unknown) => {
      console.error("[Tensor Chats] The model call failed", error);
      return null;
    });

  const conversation: ChatMessage[] = [
    { role: "system", content: plainChatInstructions(projects, new Date()) },
    ...contextMessages([...history, saved]),
  ];

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

      // Answer, or search and then answer: each round is one model call. A round that asks for
      // searches has them run, and their results go into the next.
      let searches = 0;
      try {
        for (let round = 0; round <= MAX_SEARCHES; round += 1) {
          const upstream = await callModel(conversation, searches < MAX_SEARCHES);
          if (!upstream || !upstream.ok || !upstream.body) {
            status = "failed";
            failure = await upstreamFailure(upstream);
            break;
          }
          const calls: ToolCall[] = [];
          let said = "";
          for await (const event of readStream(upstream.body, upstreamAbort.signal)) {
            if (event.kind === "text") {
              said += event.text;
              answer += event.text;
              send({ type: "delta", text: event.text });
            } else {
              calls.push(event.call);
            }
          }
          if (calls.length === 0) break;

          conversation.push({ role: "assistant", content: said || null, tool_calls: calls });
          for (const call of calls) {
            const query = searchQuery(call);
            let result: unknown;
            if (!query) result = { error: "A search needs a query." };
            else if (searches >= MAX_SEARCHES) result = { error: "No more searches for this message. Answer from what you have." };
            else {
              searches += 1;
              send({ type: "search", query });
              result = await searchTheWeb(admin, user.id, turnKey, searches, query);
            }
            conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
          }
          // Words said before a search run on into the answer that follows it.
          if (said && !said.endsWith("\n")) {
            answer += "\n\n";
            send({ type: "delta", text: "\n\n" });
          }
        }
      } catch (error) {
        if (upstreamAbort.signal.aborted) status = "stopped";
        else {
          console.error("[Tensor Chats] The answer broke off", error);
          status = "failed";
          failure = { code: "answer_interrupted", error: "The answer was cut short. Try again." };
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

/**
 * One search of the live web, for Tensor to read. Billed like a model call, against the account's
 * month: Cencori Web's price per search, recorded on this turn. A search that fails costs nothing,
 * and an account searching faster than its per-minute allowance is told to wait.
 */
async function searchTheWeb(
  admin: Parameters<typeof readPlainMessages>[0],
  userId: string,
  turnKey: string,
  number: number,
  query: string,
): Promise<unknown> {
  const slot = await takeWebSearchSlot(`tensor-chat:${userId}`, "free").catch(() => ({ allowed: true }));
  if (!slot.allowed) return { error: "Too many searches this minute. Answer from what you know, and say so." };
  let results: Awaited<ReturnType<typeof liveWebSearch>>;
  try {
    results = await liveWebSearch(query, { limit: SEARCH_RESULTS });
  } catch (error) {
    console.error("[Tensor Chats] A web search failed", error);
    return { error: "The search did not work. Answer from what you know, and say so." };
  }
  const { error } = await admin.rpc("basecode_record_gateway_usage", {
    p_user_id: userId,
    p_gateway_request_id: `${turnKey}:search:${number}`,
    p_cost_microusd: Math.round(WEB_PRICES_USD["web/search"] * 1_000_000),
  });
  if (error) console.error("[Tensor Chats] Recording a web search failed", error);
  return {
    query,
    results: results.map((result) => ({
      title: result.title,
      url: result.canonicalUrl || result.url,
      snippet: result.snippet,
      published: result.publishedAt,
    })),
  };
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

/** The account's projects, for Tensor to know what the person is already building and where. */
async function readProjects(
  admin: Parameters<typeof readPlainMessages>[0],
  userId: string,
): Promise<ProjectSummary[]> {
  const [{ data: tasks }, { data: deployments }, { data: chats }] = await Promise.all([
    admin
      .from("tensor_cloud_tasks")
      .select("id, project_name, updated_at")
      .eq("user_id", userId)
      .not("project_name", "is", null)
      .is("archived_at", null)
      .not("status", "in", "(deleted,failed,spare)")
      .order("updated_at", { ascending: false })
      .limit(30),
    admin.from("tensor_cloud_deployments").select("task_id, name, published_at").eq("user_id", userId),
    admin
      .from("tensor_cloud_chats")
      .select("task_id, title")
      .eq("user_id", userId)
      .is("archived_at", null)
      .not("title", "is", null)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);
  const addresses = new Map(
    (deployments ?? [])
      .filter((row) => row.published_at)
      .map((row) => [row.task_id as string, `${row.name as string}.cencori.app`]),
  );
  const recent = new Map<string, string[]>();
  for (const chat of chats ?? []) {
    const titles = recent.get(chat.task_id as string) ?? [];
    if (titles.length < 3) titles.push(String(chat.title).slice(0, 80));
    recent.set(chat.task_id as string, titles);
  }
  return (tasks ?? []).map((task) => ({
    name: String(task.project_name),
    address: addresses.get(task.id as string) ?? null,
    updatedAt: String(task.updated_at),
    recentChats: recent.get(task.id as string) ?? [],
  }));
}

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
  saveTrace,
  titleFromMessage,
  type ChatAction,
  type TracePart,
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

/** Rounds of answering, then acting, that one message may take. */
const MAX_ROUNDS = 5;

/** What Tensor can do in a plain chat. Each shows in the answer's trace as it happens. */
const TOOLS = [
  {
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
  },
  {
    type: "function",
    function: {
      name: "propose_project",
      description:
        "Propose a new project to build what was agreed. The person sees a card with a Create project button; nothing is created until they press it. Use only when they want to build it.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "A short project name, one to four words." },
          brief: { type: "string", description: "The project's first message, written to Tensor as the builder. At most 250 words." },
        },
        required: ["name", "brief"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "continue_in_project",
      description:
        "Take the work to one of the person's projects. They see a card that opens that project with the brief ready to send; nothing happens until they send it.",
      parameters: {
        type: "object",
        properties: {
          project: { type: "string", description: "The project's name, exactly as listed." },
          brief: { type: "string", description: "The message that project's chat will start with, written to Tensor as the builder." },
        },
        required: ["project", "brief"],
      },
    },
  },
] as const;

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
  const callModel = (messages: ChatMessage[], withTools: boolean) =>
    inference(
      new NextRequest(`${origin}/api/tensor/inference/v1/chat/completions`, {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: JSON.stringify({
          model: CHAT_MODEL,
          stream: true,
          max_tokens: ANSWER_MAX_TOKENS,
          messages,
          ...(withTools ? { tools: TOOLS, tool_choice: "auto" } : {}),
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
      /** How the answer unfolds: its text, and each search between, in order. */
      const parts: TracePart[] = [];
      const write = (text: string) => {
        answer += text;
        const last = parts.at(-1);
        if (last?.type === "text") last.text += text;
        else parts.push({ type: "text", text });
        send({ type: "delta", text });
      };
      let status: "complete" | "stopped" | "failed" = "complete";
      let failure: { code: string; error: string } | null = null;

      // Answer, or search and then answer: each round is one model call. A round that asks for
      // searches has them run, and their results go into the next.
      // Answer, or act and then answer: each round is one model call. A round that asks for
      // actions has them done, shown in the trace as they happen, and their results go into the
      // next. The last round has no tools, so it can only answer.
      let searches = 0;
      let proposed = false;
      try {
        for (let round = 0; round < MAX_ROUNDS; round += 1) {
          const upstream = await callModel(conversation, round < MAX_ROUNDS - 1);
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
              write(event.text);
            } else {
              calls.push(event.call);
            }
          }
          if (calls.length === 0) break;

          conversation.push({ role: "assistant", content: said || null, tool_calls: calls });
          for (const call of calls) {
            const action = readAction(call);
            if (!action) {
              conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "That is not something you can do here." }) });
              continue;
            }
            send({ type: "action", name: action.name, input: action.input });
            let step: TracePart;
            let result: unknown;
            if (action.name === "web_search") {
              if (searches >= MAX_SEARCHES) {
                step = { type: "action", ...action, status: "failed", error: "No more searches for this message." };
                result = { error: "No more searches for this message. Answer from what you have." };
              } else {
                searches += 1;
                result = await searchTheWeb(admin, user.id, turnKey, searches, action.input.query);
                const found = (result as { results?: { title: string; url: string }[] }).results;
                step = found
                  ? { type: "action", ...action, status: "done", results: found.map((item) => ({ title: item.title, url: item.url })) }
                  : { type: "action", ...action, status: "failed", error: "The search did not work." };
              }
            } else if (proposed) {
              step = { type: "action", ...action, status: "failed", error: "Only one proposal per answer." };
              result = { error: "You already proposed something in this answer." };
            } else if (action.name === "continue_in_project" && !projects.some((project) => sameName(project.name, action.input.project))) {
              step = { type: "action", ...action, status: "failed", error: "No project by that name." };
              result = { error: `There is no project named "${action.input.project}". Use one of the names listed, or propose a new project.` };
            } else {
              proposed = true;
              step = { type: "action", ...action, status: "done" };
              result = { shown: "The person now sees a card for this. Tell them briefly to press it when ready." };
            }
            parts.push(step);
            send({ type: "action_done", ...stepEvent(step) });
            conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
          }
          // Words said before an action run on into the answer that follows it.
          if (said && !said.endsWith("\n")) write("\n\n");
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
          // The trace is extra: an answer is kept and shown even when how it unfolded is not.
          await saveTrace(admin, { messageId: message.id, chatId: chat.id, parts }).catch((error: unknown) =>
            console.error("[Tensor Chats] Saving a trace failed", error),
          );
          const shown = { ...plainMessageJson(message), parts: parts.some((part) => part.type === "action") ? parts : null };
          if (status === "failed" && failure) send({ type: "error", ...failure, message: shown });
          else send({ type: "done", message: shown });
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

/** A tool call as one of the chat's actions, with what it was asked, or null when it is not one. */
function readAction(call: ToolCall): { name: ChatAction; input: Record<string, string> } | null {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
  } catch {
    return null;
  }
  const text = (key: string, max: number) => (typeof args[key] === "string" ? (args[key] as string).trim().slice(0, max) : "");
  if (call.function.name === "web_search") {
    const query = searchQuery(call);
    return query ? { name: "web_search", input: { query } } : null;
  }
  if (call.function.name === "propose_project") {
    const name = text("name", 100);
    const brief = text("brief", 4000);
    return name && brief ? { name: "propose_project", input: { name, brief } } : null;
  }
  if (call.function.name === "continue_in_project") {
    const project = text("project", 100);
    const brief = text("brief", 4000);
    return project && brief ? { name: "continue_in_project", input: { project, brief } } : null;
  }
  return null;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** A finished step as the page is told it: everything but its type. */
function stepEvent(step: TracePart) {
  if (step.type !== "action") return {};
  return { name: step.name, status: step.status, input: step.input, results: step.results ?? [], error: step.error ?? null };
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

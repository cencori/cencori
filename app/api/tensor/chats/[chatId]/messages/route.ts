import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { POST as inference } from "@/app/api/tensor/inference/v1/[...path]/route";
import { invalidateTensorAccess, setCachedTensorAccess } from "@/lib/config-cache";
import { noStoreHeaders } from "@/lib/tensor-auth";
import {
  PLAIN_CHAT_MESSAGE_MAX,
  withActionNotes,
  stripActionNote,
  addPlainMessage,
  contextMessages,
  plainChatInstructions,
  plainMessageJson,
  readPlainChat,
  readPlainMessages,
  readTraces,
  saveTrace,
  titleFromMessage,
  type ChatAction,
  type TracePart,
  updatePlainChat,
  type ProjectSummary,
} from "@/lib/tensor-chats";
import { readStream, searchQuery, type ChatMessage, type ToolCall } from "@/lib/tensor-chats-stream";
import { authenticateTensorDataRequest } from "@/lib/tensor-data";
import { learnFromTurn, promptContext, readChat, recordTurn, rememberFact, searchChats } from "@/lib/tensor-memory";
import { describeImage, IMAGE_DATA_URL, imageNotes } from "@/lib/tensor-vision";
import { gatewayEntitlementFrom } from "@/lib/tensor-entitlement";
import { getTensorBillingSnapshot } from "@/lib/tensor-billing";
import { fetchWebResource } from "@/lib/web/fetch";
import { extractWebDocument } from "@/lib/web/html";
import { liveWebSearch, takeWebSearchSlot } from "@/lib/web/live-search";
import { WEB_PRICES_USD } from "@/lib/web/pricing";

/** The model a plain chat answers with: the one the web's project chats use, open to every plan. */
const CHAT_MODEL = "maximo-atlas-1.5";
/**
 * What the web's model picker may choose instead (its Auto is CHAT_MODEL). The plan's model rules
 * are applied by the inference route, as for every call; this only keeps unknown names out.
 */
const PICKABLE_MODELS = new Set(["deepseek-v4-pro", "glm-5.3-flash", "gpt-6-astra", "claude-opus-5-5"]);

/** How long one answer may go on. */
const ANSWER_MAX_TOKENS = 4096;
/** Searches one message may make, and results each brings back. */
const MAX_SEARCHES = 3;
const SEARCH_RESULTS = 6;

/** Images with one message: how many, and how large each may be as a data URL (about 5 MB). */
const MAX_IMAGES = 4;
const MAX_IMAGE_CHARS = 7_000_000;

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
        "Propose a new project to build what was agreed. The person sees a card with a Create project button. With start set, the project is created at once and Tensor starts building in it: use that when they have told you to go ahead (go, build it, create it, do it, yes), including after you proposed it earlier (send the same name and brief again). Use only when they want to build it.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "A short project name, one to four words." },
          brief: { type: "string", description: "The project's first message, written to Tensor as the builder. At most 250 words." },
          start: { type: "boolean", description: "True when the person has told you to build it now: the project is created and building starts without them pressing anything." },
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
        "Take the work to one of the person's projects. They see a card that opens that project with the brief ready to send. With start set, the project opens at once and Tensor starts on the brief: use that when they have told you to go ahead.",
      parameters: {
        type: "object",
        properties: {
          project: { type: "string", description: "The project's name, exactly as listed." },
          brief: { type: "string", description: "The message that project's chat will start with, written to Tensor as the builder." },
          start: { type: "boolean", description: "True when the person has told you to go ahead now: the work starts without them pressing anything." },
        },
        required: ["project", "brief"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_page",
      description:
        "Read a web page: its title and text. Use it to read a link the person gives you, or a search result whose snippet is not enough.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "The page's full address, starting with https://." } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "project_status",
      description:
        "Check on one of the person's projects: whether it is published and where, when it was last worked on, and its latest chats.",
      parameters: {
        type: "object",
        properties: { project: { type: "string", description: "The project's name, exactly as listed." } },
        required: ["project"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember",
      description:
        "Save one lasting fact about the person to Tensor's memory, so every later chat knows it: their name, work, preferences, a decision. Use it when they ask you to remember something, or when you learn something about them worth keeping. One self-contained sentence; never a secret.",
      parameters: {
        type: "object",
        properties: { fact: { type: "string", description: "The fact, as one sentence that makes sense on its own." } },
        required: ["fact"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_chats",
      description:
        "Search all of the person's earlier chats with Tensor, plain chats and project chats alike, for what was said about something. Returns the chats that match, newest first, each with its id and the part that matched.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "The words to look for, as they might have been said." } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_chat",
      description: "Read one of the person's earlier chats, turn by turn, by the id search_chats gave.",
      parameters: {
        type: "object",
        properties: { chat_id: { type: "string", description: "The chat's id." } },
        required: ["chat_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_usage",
      description:
        "Check the person's Tensor plan and how much of its allowance is used: the plan, the share used, tasks used, and when it resets or ends.",
      parameters: { type: "object", properties: {} },
    },
  },
] as const;

/** Pages one message may read, and how much of each Tensor is given. */
const MAX_READS = 3;
const PAGE_TEXT_MAX = 12_000;

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
  /** Pictures sent with the message (pasted or dropped), as data URLs: seen by the model this turn. */
  let images: string[] = [];
  /** The model that answers: the one picked, or the chat's own. */
  let model = CHAT_MODEL;
  try {
    const body = (await request.json()) as { content?: unknown; images?: unknown; model?: unknown };
    text = typeof body.content === "string" ? body.content.trim() : "";
    if (typeof body.model === "string" && PICKABLE_MODELS.has(body.model)) model = body.model;
    images = Array.isArray(body.images)
      ? body.images.filter((image): image is string => typeof image === "string" && IMAGE_DATA_URL.test(image))
      : [];
  } catch {
    return json({ error: "That request is invalid." }, 400);
  }
  if (images.length > MAX_IMAGES) return json({ error: `Send at most ${MAX_IMAGES} images with a message.` }, 413);
  if (images.some((image) => image.length > MAX_IMAGE_CHARS)) return json({ error: "One of the images is too large. Keep each under 5 MB." }, 413);
  // A picture alone is a message too.
  if (!text && images.length) text = images.length === 1 ? "(Sent an image.)" : `(Sent ${images.length} images.)`;
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
    p_model: model,
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
  let traces: Map<string, TracePart[]>;
  try {
    [history, projects, traces] = await Promise.all([
      readPlainMessages(admin, chat.id),
      readProjects(admin, user.id),
      // Best effort: without them the model still has the conversation's words.
      readTraces(admin, chat.id).catch(() => new Map<string, TracePart[]>()),
    ]);
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
          model,
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

  // What Tensor remembers about the person, for this message; and on a chat's first message, their
  // other chats about the same thing. Memory that cannot be read says nothing.
  const memory = await promptContext(admin, {
    userId: user.id,
    taskId: null,
    prompt: text,
    first: history.length === 0,
    known: [],
    place: { kind: "plain", chatId: chat.id },
  }).catch(() => ({ context: "", ids: [] as string[] }));

  const conversation: ChatMessage[] = [
    { role: "system", content: plainChatInstructions(projects, new Date(), memory.context) },
    // Each answer's note of what it did (a proposal shown, a search made) goes on the message after
    // it, so the model knows the cards under its answers are there.
    ...contextMessages(withActionNotes([...history, saved], traces, Boolean(chat.project_task_id))),
  ];
  // This message's pictures are looked at by the vision model first, as the desktop app does, and
  // what it sees goes into the message as words: so the answer can use them whatever model writes
  // it. A picture that could not be looked at is said so, rather than guessed at.
  const last = conversation.at(-1);
  if (images.length && last?.role === "user" && typeof last.content === "string") {
    const seen = await Promise.all(images.map((url) => describeImage(authorization, origin, url)));
    last.content = `${last.content}\n\n${imageNotes(seen)}`;
  }

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
      const emit = (text: string) => {
        answer += text;
        const last = parts.at(-1);
        if (last?.type === "text") last.text += text;
        else parts.push({ type: "text", text });
        send({ type: "delta", text });
      };
      // The head of each round's words is held until it is clear it is not a note in square
      // brackets the model wrote itself (it is told not to): that is Tensor's to write, never shown.
      let head: string | null = null;
      const write = (raw: string) => {
        if (head === null) return emit(raw);
        head += raw;
        const start = head.trimStart();
        if (start === "" || (start.startsWith("[") && !start.includes("]") && start.length < 600)) return;
        const text = stripActionNote(head);
        head = null;
        if (text) emit(text);
      };
      const flushHead = () => {
        const text = head ? stripActionNote(head) : "";
        head = null;
        if (text.trim()) emit(text);
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
      let reads = 0;
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
          head = "";
          try {
            for await (const event of readStream(upstream.body, upstreamAbort.signal)) {
              if (event.kind === "text") {
                said += event.text;
                write(event.text);
              } else {
                calls.push(event.call);
              }
            }
          } finally {
            flushHead();
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
            } else if (action.name === "read_page") {
              if (reads >= MAX_READS) {
                step = { type: "action", ...action, status: "failed", error: "No more pages for this message." };
                result = { error: "No more pages for this message. Answer from what you have." };
              } else {
                reads += 1;
                const page = await readPage(admin, user.id, turnKey, reads, action.input.url);
                result = page;
                step = "content" in page
                  ? { type: "action", ...action, status: "done", results: [{ title: page.title, url: page.url }] }
                  : { type: "action", ...action, status: "failed", error: "The page could not be read." };
              }
            } else if (action.name === "project_status") {
              const project = projects.find((item) => sameName(item.name, action.input.project));
              step = project
                ? { type: "action", ...action, status: "done" }
                : { type: "action", ...action, status: "failed", error: "No project by that name." };
              result = project
                ? {
                    name: project.name,
                    published: Boolean(project.address),
                    address: project.address ? `https://${project.address}` : null,
                    lastWorkedOn: project.updatedAt,
                    latestChats: project.recentChats,
                  }
                : { error: `There is no project named "${action.input.project}".` };
            } else if (action.name === "remember") {
              const saved = await rememberFact(admin, { userId: user.id, taskId: null, about: "you", content: action.input.fact });
              step = saved.ok ? { type: "action", ...action, status: "done" } : { type: "action", ...action, status: "failed", error: saved.error };
              result = saved.ok ? { saved: true } : { error: saved.error };
            } else if (action.name === "search_chats") {
              const chats = await searchChats(admin, { userId: user.id, query: action.input.query, limit: 6, exclude: { kind: "plain", chatId: chat.id } });
              step = { type: "action", ...action, status: "done" };
              result = chats.length ? { chats } : { chats: [], note: "No earlier chat matched. Try other words, or ask them." };
            } else if (action.name === "read_chat") {
              const found = await readChat(admin, { userId: user.id, chatId: action.input.chat_id });
              step = found ? { type: "action", ...action, status: "done" } : { type: "action", ...action, status: "failed", error: "No such chat." };
              result = found ?? { error: "No chat of theirs has that id." };
            } else if (action.name === "check_usage") {
              const usage = await readUsage(admin, user.id);
              step = usage ? { type: "action", ...action, status: "done" } : { type: "action", ...action, status: "failed", error: "Usage could not be read." };
              result = usage ?? { error: "Usage could not be read just now." };
            } else if (proposed) {
              step = { type: "action", ...action, status: "failed", error: "Only one proposal per answer." };
              result = { error: "You already proposed something in this answer." };
            } else if (action.name === "continue_in_project" && !projects.some((project) => sameName(project.name, action.input.project))) {
              step = { type: "action", ...action, status: "failed", error: "No project by that name." };
              result = { error: `There is no project named "${action.input.project}". Use one of the names listed, or propose a new project.` };
            } else {
              proposed = true;
              step = { type: "action", ...action, status: "done" };
              result =
                action.input.start === "yes"
                  ? { started: "The project is being created now and Tensor starts building in it straight away. Say so in one short line; do not ask them to press anything." }
                  : { shown: "The person now sees a card for this. Tell them briefly to press it when ready." };
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
            model,
          });
          // The trace is extra: an answer is kept and shown even when how it unfolded is not.
          await saveTrace(admin, { messageId: message.id, chatId: chat.id, parts }).catch((error: unknown) =>
            console.error("[Tensor Chats] Saving a trace failed", error),
          );
          // Kept for other chats to find, and read for anything worth remembering, after the answer.
          if (status === "complete" && answer.trim()) {
            const turn = { userId: user.id, place: { kind: "plain" as const, chatId: chat.id }, turnKey: `plain:${saved.id}`, prompt: text, answer };
            waitUntil(
              recordTurn(admin, turn).then((kept) =>
                kept ? learnFromTurn(admin, { userId: user.id, taskId: null, prompt: text, answer, source: "plain-chat" }) : undefined,
              ),
            );
          }
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

/**
 * One web page, read for Tensor: its title and text, cut to a length it can use. Billed like a
 * search, at Cencori Web's price for a fetch; a page that cannot be read costs nothing.
 */
async function readPage(
  admin: Parameters<typeof readPlainMessages>[0],
  userId: string,
  turnKey: string,
  number: number,
  url: string,
): Promise<{ title: string; url: string; content: string } | { error: string }> {
  let document: ReturnType<typeof extractWebDocument>;
  try {
    const resource = await fetchWebResource(url, { timeoutMs: 15_000, maxBytes: 2 * 1024 * 1024 });
    document = extractWebDocument(resource);
  } catch (error) {
    console.error("[Tensor Chats] Reading a page failed", error);
    return { error: "That page could not be read (it may block readers, need a sign-in, or not be a web page). Say so." };
  }
  const { error } = await admin.rpc("basecode_record_gateway_usage", {
    p_user_id: userId,
    p_gateway_request_id: `${turnKey}:read:${number}`,
    p_cost_microusd: Math.round(WEB_PRICES_USD["web/fetch"] * 1_000_000),
  });
  if (error) console.error("[Tensor Chats] Recording a page read failed", error);
  const content = document.content.length > PAGE_TEXT_MAX ? `${document.content.slice(0, PAGE_TEXT_MAX)}\n\n[The rest of the page is not shown.]` : document.content;
  return { title: document.title || document.canonicalUrl, url: document.canonicalUrl || url, content };
}

/** The person's plan and how much of it is used, as the usage card reads it. */
async function readUsage(admin: Parameters<typeof readPlainMessages>[0], userId: string) {
  try {
    const snapshot = await getTensorBillingSnapshot(admin, userId);
    return {
      plan: snapshot.plan.name,
      onTrial: snapshot.plan.tier === "trial",
      percentageUsed: snapshot.usage.percentageUsed,
      resetsAt: snapshot.usage.resetsAt ?? null,
      planEndsAt: snapshot.plan.endsAt ?? null,
      renews: snapshot.plan.renews,
    };
  } catch (error) {
    console.error("[Tensor Chats] Reading usage failed", error);
    return null;
  }
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
    return name && brief ? { name: "propose_project", input: { name, brief, ...(args.start === true ? { start: "yes" } : {}) } } : null;
  }
  if (call.function.name === "read_page") {
    const url = text("url", 2000);
    return /^https?:\/\//i.test(url) ? { name: "read_page", input: { url } } : null;
  }
  if (call.function.name === "project_status") {
    const project = text("project", 100);
    return project ? { name: "project_status", input: { project } } : null;
  }
  if (call.function.name === "check_usage") return { name: "check_usage", input: {} };
  if (call.function.name === "remember") {
    const fact = text("fact", 600);
    return fact ? { name: "remember", input: { fact } } : null;
  }
  if (call.function.name === "search_chats") {
    const query = text("query", 300);
    return query ? { name: "search_chats", input: { query } } : null;
  }
  if (call.function.name === "read_chat") {
    const chatId = text("chat_id", 64);
    return chatId ? { name: "read_chat", input: { chat_id: chatId } } : null;
  }
  if (call.function.name === "continue_in_project") {
    const project = text("project", 100);
    const brief = text("brief", 4000);
    return project && brief ? { name: "continue_in_project", input: { project, brief, ...(args.start === true ? { start: "yes" } : {}) } } : null;
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

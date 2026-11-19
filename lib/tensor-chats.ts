import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Plain chats: talking with Tensor outside any project (database/brimble/2100_tensor_chats.sql).
 *
 * A project's chat runs in its sandbox and keeps its conversation there. A plain chat has no
 * sandbox, so its messages are kept here, and each answer is one model call through Cencori,
 * billed by what it costs against the plan's monthly ceiling, not as a task.
 */

export type PlainChatRow = {
  id: string;
  user_id: string;
  title: string | null;
  project_task_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlainChatMessageRow = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "stopped" | "failed";
  model: string | null;
  created_at: string;
};

/** How many chats a list returns; the sidebar shows the most recent. */
export const PLAIN_CHAT_LIST_LIMIT = 200;
/** A message the user sends, at most. */
export const PLAIN_CHAT_MESSAGE_MAX = 32_000;
/** How much of the conversation goes back to the model with each message, newest first. */
const CONTEXT_MESSAGES = 40;
const CONTEXT_CHARACTERS = 120_000;

const CHAT_COLUMNS = "id, user_id, title, project_task_id, archived_at, created_at, updated_at";
const MESSAGE_COLUMNS = "id, chat_id, role, content, status, model, created_at";

export function plainChatJson(row: PlainChatRow) {
  return {
    id: row.id,
    title: row.title,
    projectTaskId: row.project_task_id,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function plainMessageJson(row: PlainChatMessageRow) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listPlainChats(admin: SupabaseClient, userId: string): Promise<PlainChatRow[]> {
  const { data, error } = await admin
    .from("tensor_chats")
    .select(CHAT_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(PLAIN_CHAT_LIST_LIMIT);
  if (error) throw error;
  return (data ?? []) as PlainChatRow[];
}

export async function readPlainChat(
  admin: SupabaseClient,
  userId: string,
  chatId: string,
): Promise<PlainChatRow | null> {
  if (!isUuid(chatId)) return null;
  const { data, error } = await admin
    .from("tensor_chats")
    .select(CHAT_COLUMNS)
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as PlainChatRow | null) ?? null;
}

export async function createPlainChat(
  admin: SupabaseClient,
  userId: string,
  title: string | null,
): Promise<PlainChatRow> {
  const { data, error } = await admin
    .from("tensor_chats")
    .insert({ user_id: userId, title })
    .select(CHAT_COLUMNS)
    .single();
  if (error) throw error;
  return data as PlainChatRow;
}

export async function updatePlainChat(
  admin: SupabaseClient,
  chatId: string,
  change: { title?: string; archived?: boolean; projectTaskId?: string; touch?: boolean },
): Promise<void> {
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (change.title !== undefined) fields.title = change.title;
  if (change.archived !== undefined) fields.archived_at = change.archived ? new Date().toISOString() : null;
  if (change.projectTaskId !== undefined) fields.project_task_id = change.projectTaskId;
  const { error } = await admin.from("tensor_chats").update(fields).eq("id", chatId);
  if (error) throw error;
}

export async function deletePlainChat(admin: SupabaseClient, chatId: string): Promise<void> {
  const { error } = await admin.from("tensor_chats").delete().eq("id", chatId);
  if (error) throw error;
}

export async function readPlainMessages(
  admin: SupabaseClient,
  chatId: string,
): Promise<PlainChatMessageRow[]> {
  const { data, error } = await admin
    .from("tensor_chat_messages")
    .select(MESSAGE_COLUMNS)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as PlainChatMessageRow[];
}

export async function addPlainMessage(
  admin: SupabaseClient,
  message: {
    chatId: string;
    userId: string;
    role: "user" | "assistant";
    content: string;
    status?: "complete" | "stopped" | "failed";
    model?: string | null;
  },
): Promise<PlainChatMessageRow> {
  const { data, error } = await admin
    .from("tensor_chat_messages")
    .insert({
      chat_id: message.chatId,
      user_id: message.userId,
      role: message.role,
      content: message.content,
      status: message.status ?? "complete",
      model: message.model ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return data as PlainChatMessageRow;
}

/** A chat's name from its first message: its first line, cut to a sidebar's width. */
export function titleFromMessage(text: string): string {
  const line = text.trim().split("\n")[0]?.replace(/\s+/g, " ").trim() ?? "";
  if (line.length <= 60) return line || "New chat";
  return `${line.slice(0, 57).trimEnd()}…`;
}

export type ProjectSummary = {
  name: string;
  /** Its live address, when it is published. */
  address: string | null;
  /** When it was last worked on. */
  updatedAt: string;
  /** Its newest chats' names: roughly what is being built in it. */
  recentChats: string[];
};

/** One project as Tensor is told about it: one line, newest work first. */
export function describeProject(project: ProjectSummary): string {
  const parts = [`- ${project.name}`];
  if (project.address) parts.push(`live at ${project.address}`);
  parts.push(`last worked on ${project.updatedAt.slice(0, 10)}`);
  if (project.recentChats.length) {
    parts.push(`recent chats: ${project.recentChats.map((title) => `"${title}"`).join(", ")}`);
  }
  return parts.join("; ");
}

/**
 * What Tensor is told about itself in a plain chat. It is a conversation, not a build: there is no
 * computer here to run anything on, so building happens in a project, and it says so when the talk
 * turns that way.
 */
export function plainChatInstructions(projects: ProjectSummary[], today: Date): string {
  const list = projects.length
    ? projects.map(describeProject).join("\n")
    : "None yet.";
  return [
    "You are Tensor, made by Cencori. You build software for people, and you are also good company for thinking: answering questions, explaining, writing, planning, and brainstorming ideas.",
    "",
    "This is a plain chat, outside any project. Here you can talk, think and write, but you cannot run code, edit files, or build, preview or publish anything: that happens inside a project, where Tensor has a computer of its own for it.",
    "",
    "You can search the live web with the web_search tool. Search when the answer depends on anything current (news, prices, releases, schedules, who holds a role now), when you are not sure of a fact, and when asked to look something up; do not search for what you already know well. Up to three searches per message: make each query specific. Base the answer on what the results say, and cite the pages you used as Markdown links ([title](url)), next to the claims they support. If the results do not answer the question, say so rather than guessing. Never say you cannot browse the web.",
    "",
    "When a conversation turns into something to build (an app, a site, a tool), say so once, briefly, and offer to set it up as a project. Do not push; only offer when it is clearly where the talk is going, and not again if they decline.",
    "",
    "Your earlier answers may begin with a line in square brackets saying what you did in them (a project you proposed, a search you made). Tensor adds that line so you remember: the cards it names are on screen under those answers. Never write such a line yourself.",
    "",
    "When they say yes, or ask you to create the project or start building, call propose_project with a short name (one to four words) and a brief: the first message the project will start with, written to Tensor as the builder, covering what to build, for whom, the features and decisions agreed in this conversation, and the style, complete enough that nothing has to be explained again, in at most 250 words.",
    "The person sees the proposal as a card with a Create project button. Nothing is created until they press it, so say so plainly (\"Press Create project when you are ready\"); never claim the project exists.",
    "",
    "Their projects are listed below, with what has been happening in each. When what they want to build belongs in one of them (a feature for it, a fix, a change), say which, and offer to take it there rather than starting a new project. When they agree, or ask you to, call continue_in_project with the project's name exactly as listed and a brief: the message that project's chat will start with, written to Tensor as the builder, with what was agreed here. The person sees it as a card with a Continue button that opens the project with the brief ready to send; nothing happens until they send it.",
    "",
    "You can also read a web page with read_page (a link they give you, or a search result whose snippet is not enough), check on one of their projects with project_status, and check their plan and how much of it is used with check_usage. Use these instead of guessing.",
    "",
    "Everything you do with a tool is shown to the person as it happens, so there is no need to announce it at length; a short line before is enough.",
    "",
    "Their projects, most recently worked on first:",
    list,
    "",
    "Write in plain, warm, direct language. Use Markdown where it helps (lists, headings for long answers, code blocks with a language). Keep answers as short as the question allows.",
    `Today is ${today.toISOString().slice(0, 10)}.`,
  ].join("\n");
}

/** The conversation to send, newest messages kept first when it is long. */
export function contextMessages(
  messages: Pick<PlainChatMessageRow, "role" | "content" | "status">[],
): { role: "user" | "assistant"; content: string }[] {
  const kept: { role: "user" | "assistant"; content: string }[] = [];
  let characters = 0;
  for (let index = messages.length - 1; index >= 0 && kept.length < CONTEXT_MESSAGES; index -= 1) {
    const message = messages[index];
    if (!message.content) continue;
    characters += message.content.length;
    if (characters > CONTEXT_CHARACTERS && kept.length > 0) break;
    kept.unshift({ role: message.role, content: message.content });
  }
  // A conversation sent to a model starts with the person, not with an answer.
  while (kept[0]?.role === "assistant") kept.shift();
  return kept;
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

/** One part of how an answer unfolded: what Tensor wrote, or a web search it made. */
/** What Tensor can do in a plain chat; each shows in the answer's trace as it happens. */
export type ChatAction =
  | "web_search"
  | "read_page"
  | "project_status"
  | "check_usage"
  | "propose_project"
  | "continue_in_project";

export type TracePart =
  | { type: "text"; text: string }
  | {
      type: "action";
      name: ChatAction;
      status: "done" | "failed";
      /** What it was asked to do: a search's query; a project's name and brief. */
      input: Record<string, string>;
      /** A search's pages; the page that was read. */
      results?: { title: string; url: string }[];
      /** Why it failed, in words for the person. */
      error?: string;
    };

/**
 * What an answer did, in a line the model reads with it next time. The conversation sent to the
 * model is the answers' text alone, and its actions were kept apart (the trace), so on the next
 * turn it had no idea it had proposed a project: it would say "there's no proposal card yet" under
 * the card it had just made. `created` is whether the person has since made the chat's project.
 */
export function actionNote(parts: TracePart[] | undefined, created: boolean): string | null {
  const done = (parts ?? []).filter((part): part is Extract<TracePart, { type: "action" }> => part.type === "action" && part.status === "done");
  if (!done.length) return null;
  const said = done.map((action) => {
    switch (action.name) {
      case "propose_project":
        return `proposed the project "${action.input.name ?? "a project"}" (a card with a Create project button was shown under your answer${created ? "; the person has since created it" : ""})`;
      case "continue_in_project":
        return `offered to continue in the project "${action.input.project ?? "a project"}" (a card with a button to go there was shown)`;
      case "web_search":
        return `searched the web for "${action.input.query ?? ""}"`;
      case "read_page":
        return `read ${action.input.url ?? "a page"}`;
      case "project_status":
        return "checked the person's projects";
      case "check_usage":
        return "checked the person's usage";
      default:
        return null;
    }
  });
  const list = said.filter(Boolean);
  return list.length ? `[In this answer you ${list.join("; ")}.]` : null;
}

/** The traces of a chat's answers, by answer. */
export async function readTraces(admin: SupabaseClient, chatId: string): Promise<Map<string, TracePart[]>> {
  const { data, error } = await admin.from("tensor_chat_traces").select("message_id, parts").eq("chat_id", chatId);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.message_id as string, row.parts as TracePart[]]));
}

/** Keeps how an answer unfolded. Only an answer that did something has anything worth keeping. */
export async function saveTrace(
  admin: SupabaseClient,
  input: { messageId: string; chatId: string; parts: TracePart[] },
): Promise<void> {
  if (!input.parts.some((part) => part.type === "action")) return;
  const { error } = await admin
    .from("tensor_chat_traces")
    .insert({ message_id: input.messageId, chat_id: input.chatId, parts: input.parts });
  if (error) throw error;
}
